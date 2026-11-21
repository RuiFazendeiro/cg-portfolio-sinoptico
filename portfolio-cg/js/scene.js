(() => {
  const cellsData = window.PORTFOLIO_CELLS || [];
  const canvas = document.getElementById("scene-canvas");
  const navContainer = document.getElementById("cell-nav");
  const panel = document.getElementById("project-panel");
  const statusEl = document.getElementById("active-status");
  const telemetryEl = document.getElementById("telemetry-readout");
  const blueprintBtn = document.getElementById("blueprint-btn");
  const audioBtn = document.getElementById("audio-btn");
  const qualitySelect = document.getElementById("quality-select");

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
  scene.fog = new THREE.FogExp2(0x090d12, 0.03);

  const camera = new THREE.PerspectiveCamera(
    48,
    window.innerWidth / window.innerHeight,
    0.1,
    120
  );
  camera.position.set(MAX_X * 0.5, 1.8, 9.5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "default" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const blueprint = window.PortfolioShaders.createBlueprintController(scene);
  const busShader = window.PortfolioShaders.createBusCurrentShaderMaterial({
    flowSpeed: 0.34,
    pulseDensity: 6.0,
    boost: 0.15
  });
  const audioEngine = window.PortfolioAudio.createAudioEngine({
    fftSize: 256,
    trackSrc: "assets/track.ogg"
  });

  // Iluminação
  const ambientLight = new THREE.AmbientLight(0xb0c4d8, 0.85);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.25);
  dirLight.position.set(6, 10, 8);
  scene.add(dirLight);

  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
  rimLight.position.set(-8, 4, -6);
  scene.add(rimLight);

  // Chão técnico com grelha
  const floorGeo = new THREE.PlaneGeometry(MAX_X + 28, 18);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0e151f,
    roughness: 0.8,
    metalness: 0.2
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(MAX_X * 0.5, -1.65, 0);
  scene.add(floor);

  const gridHelper = new THREE.GridHelper(MAX_X + 24, Math.max(12, Math.round((MAX_X + 24) / 2)), 0x1e293b, 0x131c28);
  gridHelper.position.set(MAX_X * 0.5, -1.63, 0);
  scene.add(gridHelper);

  // Barramento principal superior
  const busMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    metalness: 0.72,
    roughness: 0.28
  });
  const busGeo = new THREE.BoxGeometry(MAX_X + 10, 0.16, 0.16);
  const mainBus = new THREE.Mesh(busGeo, busShader.material);
  mainBus.position.set(MAX_X * 0.5, 2.35, -0.35);
  scene.add(mainBus);

  function wrapText(ctx, text, maxWidth, maxLines = 2) {
    const words = text.split(/\s+/);
    const lines = [];
    let current = "";

    for (let i = 0; i < words.length; i++) {
      const candidate = current ? `${current} ${words[i]}` : words[i];
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = words[i];
        if (lines.length >= maxLines) break;
      }
    }
    if (current && lines.length < maxLines) {
      lines.push(current);
    }
    if (lines.length === maxLines && ctx.measureText(lines[maxLines - 1]).width > maxWidth) {
      let last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = `${last}…`;
    }
    return lines;
  }

  function createHmiTexture(cell, energized, audioBands = null, scale = 1) {
    const c = document.createElement("canvas");
    c.width = Math.round(640 * scale);
    c.height = Math.round(320 * scale);
    const ctx = c.getContext("2d");
    ctx.scale(scale, scale);

    const w = 640;
    const h = 320;
    const pad = 28;
    const maxW = w - pad * 2;

    ctx.fillStyle = energized ? "#081824" : "#0b1119";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = energized ? "#38bdf8" : "#273749";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Cabeçalho da célula
    ctx.fillStyle = energized ? "#38bdf8" : "#64748b";
    ctx.font = "bold 18px monospace";
    ctx.fillText(cell.code, pad, 44);

    // Título com ajuste automático e até 2 linhas sem cortar
    ctx.fillStyle = "#f8fafc";
    let titleSize = 28;
    ctx.font = `bold ${titleSize}px monospace`;
    while (titleSize > 20 && ctx.measureText(cell.title).width > maxW * 1.45) {
      titleSize -= 2;
      ctx.font = `bold ${titleSize}px monospace`;
    }
    const titleLines = wrapText(ctx, cell.title, maxW, 2);
    let yCursor = 82;
    titleLines.forEach((line) => {
      ctx.fillText(line, pad, yCursor);
      yCursor += titleSize + 6;
    });

    // Estado
    yCursor = Math.max(yCursor + 8, 152);
    ctx.fillStyle = energized ? "#22c55e" : "#94a3b8";
    ctx.font = "bold 19px monospace";
    ctx.fillText(energized ? "ESTADO: LIGADO [I]" : "ESTADO: EM ESPERA [O]", pad, yCursor);

    // Visualização FFT na célula de áudio quando ativa
    if (cell.isAudioCell && audioBands && audioBands.bins) {
      const barAreaY = yCursor + 18;
      const barAreaH = 68;
      const bars = 24;
      const step = Math.max(1, Math.floor(audioBands.bins.length / bars));
      const barW = maxW / bars - 3;

      for (let i = 0; i < bars; i++) {
        const val = audioBands.bins[i * step] / 255;
        const bh = Math.max(4, val * barAreaH);
        const bx = pad + i * (barW + 3);
        const by = barAreaY + (barAreaH - bh);
        ctx.fillStyle = i < 6 ? "#38bdf8" : i < 15 ? "#22c55e" : "#f472b6";
        ctx.fillRect(bx, by, barW, bh);
      }
    } else {
      // Lista de stack contida dentro da largura útil
      const stackText = cell.stack.join(" · ");
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "16px monospace";
      const stackLines = wrapText(ctx, stackText, maxW, 2);
      let sy = yCursor + 34;
      stackLines.forEach((sl) => {
        ctx.fillText(sl, pad, sy);
        sy += 22;
      });
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  let hmiTextureScale = 1.0;
  const cellObjects = [];
  const breakerHitboxes = [];

  function buildCell(cell, index) {
    const x = index * CELL_SPACING;
    const group = new THREE.Group();
    group.position.set(x, 0, 0);

    // Bastidor metálico + moldura superior/inferior
    const cabinetMat = new THREE.MeshStandardMaterial({
      color: 0x1e2b3d,
      roughness: 0.5,
      metalness: 0.5
    });
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.35, 0.5), cabinetMat);
    group.add(cabinet);
    blueprint.registerMesh(cabinet, 20);

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.35,
      metalness: 0.7
    });
    const topTrim = new THREE.Mesh(new THREE.BoxGeometry(4.56, 0.14, 0.56), trimMat);
    topTrim.position.set(0, 1.62, 0.01);
    group.add(topTrim);
    blueprint.registerMesh(topTrim, 25);

    // Isolador cerâmico + riser até ao barramento
    const insulator = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 0.28, 12),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.1 })
    );
    insulator.position.set(0, 1.82, -0.35);
    group.add(insulator);

    const riser = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.1), busMat);
    riser.position.set(0, 2.05, -0.35);
    group.add(riser);
    blueprint.registerMesh(riser, 25);

    // Ecrã HMI frontal
    const hmiTex = createHmiTexture(cell, false, null, hmiTextureScale);
    const hmiMat = new THREE.MeshBasicMaterial({ map: hmiTex });
    const hmiScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.75, 1.88), hmiMat);
    hmiScreen.position.set(0, 0.38, 0.27);
    group.add(hmiScreen);

    // Base do disjuntor e manípulo
    const breakerBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.66, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.4 })
    );
    breakerBase.position.set(-1.4, -1.02, 0.32);
    group.add(breakerBase);
    blueprint.registerMesh(breakerBase, 25);

    const leverPivot = new THREE.Group();
    leverPivot.position.set(-1.4, -1.02, 0.43);

    const leverMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.32,
      metalness: 0.2
    });
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.44), leverMat);
    lever.position.set(0, 0, 0.18);
    leverPivot.add(lever);
    group.add(leverPivot);

    // LED indicador
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.9
    });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 14), ledMat);
    led.position.set(1.62, -1.02, 0.32);
    group.add(led);

    // Luz local da célula (ativa quando energizada)
    const cellLight = new THREE.PointLight(cell.accentColor || 0x38bdf8, 0, 5.5);
    cellLight.position.set(0, 0.5, 1.5);
    group.add(cellLight);

    // Hitbox do disjuntor
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 1.0, 0.75),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.set(-1.4, -1.02, 0.45);
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
      cellLight,
      hmiMat,
      hmiTex,
      lastFftRedraw: 0
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
    btn.addEventListener("click", async () => {
      await audioEngine.unlock();
      focusCell(idx, true);
    });
    navContainer.appendChild(btn);
  });

  let targetX = MAX_X * 0.5;
  let targetZ = 9.5;
  let targetY = 1.6;
  let selectedIndex = null;
  let hoveredCellIndex = null;
  const pointerNdc = new THREE.Vector2();
  const pointerScreen = { x: 0, y: 0 };
  const raycaster = new THREE.Raycaster();

  function refreshHmi(obj, audioBands = null) {
    const oldTex = obj.hmiTex;
    obj.hmiTex = createHmiTexture(obj.data, obj.energized, audioBands, hmiTextureScale);
    obj.hmiMat.map = obj.hmiTex;
    obj.hmiMat.needsUpdate = true;
    oldTex.dispose();
  }

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

  async function setCellEnergized(index, state, playSound = true) {
    const obj = cellObjects[index];
    if (!obj) return;
    obj.energized = state;

    obj.leverMat.color.setHex(state ? 0x22c55e : 0xef4444);
    obj.ledMat.color.setHex(state ? 0x22c55e : 0xef4444);
    obj.ledMat.emissive.setHex(state ? 0x16a34a : 0x7f1d1d);
    obj.cellLight.intensity = state ? 1.1 : 0;

    if (playSound) {
      audioEngine.playBreakerClick(state);
    }

    if (obj.data.isAudioCell) {
      await audioEngine.setMusicActive(state);
    }

    refreshHmi(obj, null);

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

  async function focusCell(index, energizeIfOff) {
    const obj = cellObjects[index];
    if (!obj) return;
    selectedIndex = index;
    targetX = obj.x;
    targetZ = 6.2;
    targetY = 1.15;

    if (energizeIfOff && !obj.energized) {
      await setCellEnergized(index, true, true);
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

  if (audioBtn) {
    audioBtn.addEventListener("click", async () => {
      const ok = await audioEngine.unlock();
      audioBtn.classList.toggle("active", ok);
      audioBtn.textContent = ok ? "Áudio: 50Hz ON" : "Áudio: N/D";
    });
  }

  function applyQualityPreset(preset) {
    if (preset === "low") {
      renderer.setPixelRatio(1.0);
      renderer.antialias = false;
      gridHelper.visible = false;
      hmiTextureScale = 0.75;
    } else if (preset === "high") {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
      gridHelper.visible = true;
      hmiTextureScale = 1.25;
    } else {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      gridHelper.visible = true;
      hmiTextureScale = 1.0;
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    cellObjects.forEach((obj) => refreshHmi(obj, null));
  }

  if (qualitySelect) {
    qualitySelect.addEventListener("change", (e) => {
      applyQualityPreset(e.target.value);
    });
  }

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

  canvas.addEventListener("click", async () => {
    await audioEngine.unlock();
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(breakerHitboxes, false);
    if (hits.length > 0) {
      const idx = hits[0].object.userData.cellIndex;
      const obj = cellObjects[idx];
      await setCellEnergized(idx, !obj.energized, true);
      await focusCell(idx, false);
    }
  });

  closePanelBtn.addEventListener("click", closePanel);
  toggleBreakerBtn.addEventListener("click", async () => {
    if (selectedIndex === null) return;
    await audioEngine.unlock();
    const obj = cellObjects[selectedIndex];
    await setCellEnergized(selectedIndex, !obj.energized, true);
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Telemetria real
  let prevTime = performance.now();
  let frameCounter = 0;
  let fpsAccumTime = 0;
  let currentFps = 60;
  let smoothedFrameMs = 16.7;

  function animate(now) {
    requestAnimationFrame(animate);
    const rawDt = now - prevTime;
    prevTime = now;
    const dt = Math.min(rawDt / 1000, 0.05);

    smoothedFrameMs = THREE.MathUtils.lerp(smoothedFrameMs, Math.min(rawDt, 100), 0.15);
    frameCounter++;
    fpsAccumTime += rawDt;
    if (fpsAccumTime >= 500) {
      currentFps = Math.round((frameCounter * 1000) / fpsAccumTime);
      frameCounter = 0;
      fpsAccumTime = 0;
      if (telemetryEl) {
        const calls = renderer.info.render.calls;
        telemetryEl.textContent = `${currentFps} FPS · ${smoothedFrameMs.toFixed(1)} ms · ${calls} draws`;
      }
    }

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

    // FFT reativo na célula de áudio
    const audioCell = cellObjects.find((c) => c.data.isAudioCell && c.energized);
    const bands = audioEngine.getFrequencyBands();
    if (audioCell && audioEngine.isTrackPlaying() && now - audioCell.lastFftRedraw > 75) {
      audioCell.lastFftRedraw = now;
      refreshHmi(audioCell, bands);
    }

    audioEngine.updateProximityHum(
      Math.abs(camera.position.x - MAX_X * 0.5),
      energizedCount,
      audioEngine.isTrackPlaying()
    );

    const bassBoost = audioEngine.isTrackPlaying() ? bands.bass * 0.65 : 0.0;
    const targetBoost = Math.min(1.8, 0.15 + energizedCount * 0.22 + hoverBoost + bassBoost);

    const bpMix = blueprint.update(dt);
    busShader.update(dt, elapsed, targetBoost, bpMix);

    renderer.render(scene, camera);
  }

  refreshHudState();
  requestAnimationFrame(animate);
})();