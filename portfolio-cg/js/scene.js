(() => {
  const cellsData = window.PORTFOLIO_CELLS || [];
  const canvas = document.getElementById("scene-canvas");
  const navContainer = document.getElementById("cell-nav");
  const panel = document.getElementById("project-panel");
  const statusEl = document.getElementById("active-status");
  const blueprintBtn = document.getElementById("blueprint-btn");

  const panelCode = document.getElementById("panel-code");
  const panelTitle = document.getElementById("panel-title");
  const panelMeta = document.getElementById("panel-meta");
  const panelSummary = document.getElementById("panel-summary");
  const panelRole = document.getElementById("panel-role");
  const panelStack = document.getElementById("panel-stack");
  const panelLink = document.getElementById("panel-link");
  const closePanelBtn = document.getElementById("close-panel");
  const toggleBreakerBtn = document.getElementById("toggle-breaker-btn");

  const CELL_SPACING = 6.2;
  const MIN_X = 0;
  const MAX_X = Math.max(0, (cellsData.length - 1) * CELL_SPACING);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090d12);
  scene.fog = new THREE.FogExp2(0x090d12, 0.032);

  const camera = new THREE.PerspectiveCamera(
    48,
    window.innerWidth / window.innerHeight,
    0.1,
    120
  );
  camera.position.set(MAX_X * 0.5, 1.8, 9.5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Shaders e modo Blueprint
  const blueprint = window.PortfolioShaders.createBlueprintController(scene);
  const busShader = window.PortfolioShaders.createBusCurrentShaderMaterial({
    flowSpeed: 0.34,
    pulseDensity: 6.0,
    boost: 0.15
  });

  // Iluminação base
  const ambientLight = new THREE.AmbientLight(0x9fb3c8, 0.75);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(6, 10, 8);
  scene.add(dirLight);

  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
  rimLight.position.set(-8, 4, -6);
  scene.add(rimLight);

  // Chão e barramento principal superior
  const floorGeo = new THREE.PlaneGeometry(MAX_X + 24, 18);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0e151f,
    roughness: 0.85,
    metalness: 0.15
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(MAX_X * 0.5, -1.6, 0);
  scene.add(floor);
  blueprint.registerMesh(floor, 25);

  const busMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    metalness: 0.7,
    roughness: 0.3
  });
  const busGeo = new THREE.BoxGeometry(MAX_X + 10, 0.16, 0.16);
  const mainBus = new THREE.Mesh(busGeo, busShader.material);
  mainBus.position.set(MAX_X * 0.5, 2.35, -0.35);
  scene.add(mainBus);

  const cellObjects = [];
  const breakerHitboxes = [];

  function createHmiTexture(cell, energized) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d");

    ctx.fillStyle = energized ? "#091924" : "#0b1017";
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.strokeStyle = energized ? "#38bdf8" : "#263545";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, c.width - 20, c.height - 20);

    ctx.fillStyle = energized ? "#38bdf8" : "#64748b";
    ctx.font = "bold 20px monospace";
    ctx.fillText(cell.code, 28, 48);

    ctx.fillStyle = "#f1f5f9";
    ctx.font = "bold 28px monospace";
    ctx.fillText(cell.title.slice(0, 28), 28, 96);

    ctx.fillStyle = energized ? "#22c55e" : "#94a3b8";
    ctx.font = "20px monospace";
    ctx.fillText(energized ? "ESTADO: LIGADO [I]" : "ESTADO: EM ESPERA [O]", 28, 146);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "17px monospace";
    ctx.fillText(cell.stack.slice(0, 4).join(" · "), 28, 206);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function buildCell(cell, index) {
    const x = index * CELL_SPACING;
    const group = new THREE.Group();
    group.position.set(x, 0, 0);

    // Bastidor metálico
    const cabinetMat = new THREE.MeshStandardMaterial({
      color: 0x1b2636,
      roughness: 0.55,
      metalness: 0.45
    });
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.3, 0.5), cabinetMat);
    group.add(cabinet);
    blueprint.registerMesh(cabinet, 20);

    // Ligação ao barramento superior
    const riser = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.1), busMat);
    riser.position.set(0, 2.0, -0.35);
    group.add(riser);
    blueprint.registerMesh(riser, 25);

    // Ecrã HMI frontal
    const hmiTex = createHmiTexture(cell, false);
    const hmiMat = new THREE.MeshBasicMaterial({ map: hmiTex });
    const hmiScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1.75), hmiMat);
    hmiScreen.position.set(0, 0.35, 0.27);
    group.add(hmiScreen);

    // Base do disjuntor e manípulo interativo
    const breakerBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.65, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 })
    );
    breakerBase.position.set(-1.35, -1.0, 0.32);
    group.add(breakerBase);
    blueprint.registerMesh(breakerBase, 25);

    const leverPivot = new THREE.Group();
    leverPivot.position.set(-1.35, -1.0, 0.43);

    const leverMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.35,
      metalness: 0.2
    });
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.42), leverMat);
    lever.position.set(0, 0, 0.18);
    leverPivot.add(lever);
    group.add(leverPivot);

    // LED indicador de estado
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.8
    });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), ledMat);
    led.position.set(1.55, -1.0, 0.32);
    group.add(led);

    // Hitbox invisível ligeiramente maior para facilitar o clique
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.0, 0.7),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.set(-1.35, -1.0, 0.45);
    hitbox.userData.cellIndex = index;
    group.add(hitbox);
    breakerHitboxes.push(hitbox);

    scene.add(group);

    return {
      data: cell,
      index,
      x,
      energized: false,
      leverPivot,
      leverMat,
      ledMat,
      hmiMat,
      hmiTex
    };
  }

  cellsData.forEach((cell, idx) => {
    cellObjects.push(buildCell(cell, idx));

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cell-btn";
    btn.dataset.index = String(idx);
    btn.textContent = `0${idx + 1}`;
    btn.title = cell.title;
    btn.addEventListener("click", () => {
      focusCell(idx, true);
    });
    navContainer.appendChild(btn);
  });

  // Estado de navegação e seleção
  let targetX = MAX_X * 0.5;
  let targetZ = 9.5;
  let targetY = 1.6;
  let selectedIndex = null;
  let hoveredCellIndex = null;
  const pointerNdc = new THREE.Vector2();
  const pointerScreen = { x: 0, y: 0 };
  const raycaster = new THREE.Raycaster();

  function refreshHudState() {
    const navButtons = navContainer.querySelectorAll(".cell-btn");
    navButtons.forEach((btn, idx) => {
      const obj = cellObjects[idx];
      btn.classList.toggle("active", selectedIndex === idx);
      btn.classList.toggle("energized", Boolean(obj && obj.energized));
    });

    const energizedCount = cellObjects.filter((c) => c.energized).length;
    statusEl.textContent = `Estado: ${energizedCount}/${cellObjects.length} células ligadas`;
  }

  function setCellEnergized(index, state) {
    const obj = cellObjects[index];
    if (!obj) return;
    obj.energized = state;

    obj.leverMat.color.setHex(state ? 0x22c55e : 0xef4444);
    obj.ledMat.color.setHex(state ? 0x22c55e : 0xef4444);
    obj.ledMat.emissive.setHex(state ? 0x16a34a : 0x7f1d1d);

    const oldTex = obj.hmiTex;
    obj.hmiTex = createHmiTexture(obj.data, state);
    obj.hmiMat.map = obj.hmiTex;
    obj.hmiMat.needsUpdate = true;
    oldTex.dispose();

    if (selectedIndex === index) {
      toggleBreakerBtn.textContent = state ? "Desligar [O]" : "Ligar [I]";
    }
    refreshHudState();
  }

  function openPanel(index) {
    const obj = cellObjects[index];
    if (!obj) return;
    const d = obj.data;

    panelCode.textContent = d.code;
    panelTitle.textContent = d.title;
    panelMeta.textContent = `Período: ${d.period}`;
    panelSummary.textContent = d.summary;
    panelRole.textContent = d.role;
    panelLink.href = d.url;

    panelStack.innerHTML = "";
    d.stack.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      panelStack.appendChild(li);
    });

    toggleBreakerBtn.textContent = obj.energized ? "Desligar [O]" : "Ligar [I]";
    panel.classList.remove("hidden");
  }

  function closePanel() {
    selectedIndex = null;
    panel.classList.add("hidden");
    targetZ = 9.5;
    targetY = 1.6;
    refreshHudState();
  }

  function focusCell(index, energizeIfOff) {
    const obj = cellObjects[index];
    if (!obj) return;
    selectedIndex = index;
    targetX = obj.x;
    targetZ = 6.2;
    targetY = 1.15;

    if (energizeIfOff && !obj.energized) {
      setCellEnergized(index, true);
    }
    openPanel(index);
    refreshHudState();
  }

  function toggleBlueprintMode() {
    const active = blueprint.toggle();
    if (blueprintBtn) {
      blueprintBtn.classList.toggle("active", active);
    }
  }

  if (blueprintBtn) {
    blueprintBtn.addEventListener("click", toggleBlueprintMode);
  }

  // Navegação por scroll e teclado
  window.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      targetX = THREE.MathUtils.clamp(targetX + e.deltaY * 0.006, MIN_X, MAX_X);
      if (selectedIndex !== null) {
        const closest = cellObjects.reduce((best, item) =>
          Math.abs(item.x - targetX) < Math.abs(best.x - targetX) ? item : best
        );
        if (Math.abs(closest.x - targetX) > 1.8) {
          closePanel();
        }
      }
    },
    { passive: false }
  );

  const keysPressed = new Set();
  window.addEventListener("keydown", (e) => {
    keysPressed.add(e.key.toLowerCase());
    if (e.key === "Escape" && selectedIndex !== null) {
      closePanel();
    }
    if (e.key.toLowerCase() === "b") {
      toggleBlueprintMode();
    }
  });
  window.addEventListener("keyup", (e) => {
    keysPressed.delete(e.key.toLowerCase());
  });

  // Hover e clique nos disjuntores via Raycaster
  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    pointerScreen.x = (e.clientX - rect.left) / rect.width - 0.5;
    pointerScreen.y = (e.clientY - rect.top) / rect.height - 0.5;

    raycaster.setFromCamera(pointerNdc, camera);
    const hoverHits = raycaster.intersectObjects(breakerHitboxes, false);
    hoveredCellIndex = hoverHits.length > 0 ? hoverHits[0].object.userData.cellIndex : null;
    canvas.style.cursor = hoveredCellIndex !== null ? "pointer" : "default";
  });

  canvas.addEventListener("click", () => {
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(breakerHitboxes, false);
    if (hits.length > 0) {
      const idx = hits[0].object.userData.cellIndex;
      const obj = cellObjects[idx];
      setCellEnergized(idx, !obj.energized);
      focusCell(idx, false);
    }
  });

  closePanelBtn.addEventListener("click", closePanel);
  toggleBreakerBtn.addEventListener("click", () => {
    if (selectedIndex === null) return;
    const obj = cellObjects[selectedIndex];
    setCellEnergized(selectedIndex, !obj.energized);
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Loop principal
  let prevTime = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - prevTime) / 1000, 0.05);
    prevTime = now;

    const moveSpeed = 7.5 * dt;
    if (keysPressed.has("a") || keysPressed.has("arrowleft")) {
      targetX = THREE.MathUtils.clamp(targetX - moveSpeed, MIN_X, MAX_X);
    }
    if (keysPressed.has("d") || keysPressed.has("arrowright")) {
      targetX = THREE.MathUtils.clamp(targetX + moveSpeed, MIN_X, MAX_X);
    }

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 1 - Math.exp(-8 * dt));
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 1 - Math.exp(-6 * dt));
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      targetY - pointerScreen.y * 0.35,
      1 - Math.exp(-6 * dt)
    );

    const lookTargetX = camera.position.x + pointerScreen.x * 0.45;
    camera.lookAt(lookTargetX, 0.25, 0);

    // Rotação suave do manípulo de cada disjuntor
    cellObjects.forEach((obj) => {
      const desiredRotX = obj.energized ? -0.55 : 0.55;
      obj.leverPivot.rotation.x = THREE.MathUtils.lerp(
        obj.leverPivot.rotation.x,
        desiredRotX,
        1 - Math.exp(-14 * dt)
      );
    });

    const elapsed = now * 0.001;
    const energizedCount = cellObjects.filter((c) => c.energized).length;
    const hoverBoost = hoveredCellIndex !== null ? 0.45 : 0.0;
    const targetBoost = Math.min(1.5, 0.15 + energizedCount * 0.22 + hoverBoost);

    const bpMix = blueprint.update(dt);
    busShader.update(dt, elapsed, targetBoost, bpMix);

    renderer.render(scene, camera);
  }

  refreshHudState();
  requestAnimationFrame(animate);
})();