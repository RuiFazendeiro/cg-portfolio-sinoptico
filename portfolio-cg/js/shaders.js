(() => {
  const BUS_VERTEX_SHADER = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormalDir;
    varying vec3 vViewPos;

    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vNormalDir = normalize(mat3(modelMatrix) * normal);
      vec4 mvPosition = viewMatrix * worldPosition;
      vViewPos = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const BUS_FRAGMENT_SHADER = /* glsl */ `
    uniform float uTime;
    uniform float uFlowSpeed;
    uniform float uPulseDensity;
    uniform float uBoost;
    uniform float uBlueprintMix;
    uniform vec3 uBaseColor;
    uniform vec3 uPulseColor;
    uniform vec3 uBlueprintColor;

    varying vec2 vUv;
    varying vec3 vNormalDir;
    varying vec3 vViewPos;

    void main() {
      vec3 normal = normalize(vNormalDir);
      vec3 viewDir = normalize(vViewPos);

      // Luz direcional simples + realce de aresta/fresnel
      vec3 lightDir = normalize(vec3(0.45, 0.75, 0.5));
      float diffuse = max(dot(normal, lightDir), 0.18);
      float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);

      // Propagação de impulsos ao longo do comprimento do barramento (vUv.x)
      float phase = vUv.x * uPulseDensity - uTime * uFlowSpeed;
      float wave = 0.5 + 0.5 * sin(phase * 6.2831853);
      float sharpPulse = pow(wave, 7.0);

      // Harmónica secundária mais fina para sensação de carga ativa
      float microPhase = vUv.x * (uPulseDensity * 2.5) - uTime * (uFlowSpeed * 1.45);
      float microPulse = pow(0.5 + 0.5 * sin(microPhase * 6.2831853), 12.0) * 0.35;

      float totalPulse = clamp((sharpPulse + microPulse) * (0.45 + uBoost * 0.85), 0.0, 1.8);

      vec3 industrialBody = uBaseColor * diffuse + vec3(0.18, 0.24, 0.32) * fresnel;
      vec3 industrialLit = industrialBody + uPulseColor * totalPulse;

      vec3 blueprintBody = uBlueprintColor * (0.35 + 0.65 * fresnel);
      vec3 blueprintLit = blueprintBody + vec3(0.55, 0.9, 1.0) * (totalPulse * 0.75);

      vec3 finalColor = mix(industrialLit, blueprintLit, uBlueprintMix);
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  function createBusCurrentShaderMaterial(options = {}) {
    const uniforms = {
      uTime: { value: 0 },
      uFlowSpeed: { value: options.flowSpeed ?? 0.32 },
      uPulseDensity: { value: options.pulseDensity ?? 6.0 },
      uBoost: { value: options.boost ?? 0.2 },
      uBlueprintMix: { value: 0.0 },
      uBaseColor: { value: new THREE.Color(options.baseColor ?? 0x854d0e) },
      uPulseColor: { value: new THREE.Color(options.pulseColor ?? 0x38bdf8) },
      uBlueprintColor: { value: new THREE.Color(options.blueprintColor ?? 0x1d4ed8) }
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: BUS_VERTEX_SHADER,
      fragmentShader: BUS_FRAGMENT_SHADER
    });

    return {
      material,
      uniforms,
      update(dt, elapsedTime, targetBoost, blueprintMix) {
        uniforms.uTime.value = elapsedTime;
        uniforms.uBlueprintMix.value = blueprintMix;

        const currentBoost = uniforms.uBoost.value;
        const nextBoost = THREE.MathUtils.lerp(
          currentBoost,
          targetBoost,
          1 - Math.exp(-8 * dt)
        );
        uniforms.uBoost.value = nextBoost;

        // Acelera ligeiramente o fluxo quando o barramento está mais carregado
        const speedTarget = (options.flowSpeed ?? 0.32) * (0.8 + nextBoost * 0.9);
        uniforms.uFlowSpeed.value = THREE.MathUtils.lerp(
          uniforms.uFlowSpeed.value,
          speedTarget,
          1 - Math.exp(-6 * dt)
        );
      }
    };
  }

  function createBlueprintController(scene, options = {}) {
    let enabled = false;
    let mix = 0.0;

    const edgeColor = options.edgeColor ?? 0x93c5fd;
    const industrialBg = new THREE.Color(options.industrialBg ?? 0x090d12);
    const blueprintBg = new THREE.Color(options.blueprintBg ?? 0x071936);

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: 0.0
    });

    const trackedEntries = [];

    function registerMesh(mesh, thresholdAngle = 22) {
      if (!mesh || !mesh.geometry) return null;
      const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
      const lines = new THREE.LineSegments(edgesGeo, edgeMaterial);
      lines.visible = false;
      mesh.add(lines);

      const originalMaterial = mesh.material;
      const entry = { mesh, lines, originalMaterial };
      trackedEntries.push(entry);
      return lines;
    }

    function setEnabled(nextState) {
      enabled = Boolean(nextState);

      trackedEntries.forEach(({ mesh, lines, originalMaterial }) => {
        lines.visible = enabled;
        if (enabled) {
          // Oculta superfícies sólidas opacas para leitura de esquema/arestas sem tapar o fundo
          if (originalMaterial && !originalMaterial.isShaderMaterial) {
            if (!mesh.userData._bpGhostMat) {
              mesh.userData._bpGhostMat = new THREE.MeshBasicMaterial({
                color: 0x0c2d5c,
                transparent: true,
                opacity: 0.22,
                depthWrite: false
              });
            }
            mesh.material = mesh.userData._bpGhostMat;
          }
        } else if (originalMaterial) {
          mesh.material = originalMaterial;
        }
      });

      return enabled;
    }

    function toggle() {
      return setEnabled(!enabled);
    }

    function update(dt) {
      const targetMix = enabled ? 1.0 : 0.0;
      mix = THREE.MathUtils.lerp(mix, targetMix, 1 - Math.exp(-10 * dt));
      edgeMaterial.opacity = mix * 0.85;

      if (scene.background && scene.background.isColor) {
        scene.background.copy(industrialBg).lerp(blueprintBg, mix);
      }
      if (scene.fog && scene.fog.color) {
        scene.fog.color.copy(industrialBg).lerp(blueprintBg, mix);
      }

      return mix;
    }

    return {
      registerMesh,
      setEnabled,
      toggle,
      update,
      isEnabled: () => enabled,
      getMix: () => mix
    };
  }

  window.PortfolioShaders = {
    createBusCurrentShaderMaterial,
    createBlueprintController
  };
})();