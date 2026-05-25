(() => {
  const REGIONS = [
    { id: "tw", region: "Taiwan", label: "台灣", account: "RenaissTwCM", color: "#2f89ff", lat: 23.6978, lng: 120.9605, labelLat: 24.1, labelLng: 122.2 },
    { id: "kr", region: "Korea", label: "韓國", account: "RenaissKrCM", color: "#8b5cf6", lat: 36.5, lng: 127.8, labelLat: 37.4, labelLng: 129.2 },
    { id: "my", region: "Malaysia", label: "馬來西亞", account: "RenaissMyCM", color: "#f5b74b", lat: 4.2105, lng: 101.9758, labelLat: 5.1, labelLng: 99.6 },
    { id: "vn", region: "Vietnam", label: "越南", account: "renaiss_vn", color: "#22c49c", lat: 14.0583, lng: 108.2772, labelLat: 15.9, labelLng: 111.0 },
    { id: "th", region: "Thailand", label: "泰國", account: "Renaiss_TH", color: "#ff7e5a", lat: 15.87, lng: 100.9925, labelLat: 18.1, labelLng: 99.4 },
  ];

  const MAP_BOUNDS = {
    centerLat: 18,
    centerLng: 112.4,
    latScale: 0.48,
    lngScale: 0.48,
  };
  const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

  const state = {
    animationFrame: 0,
    backgroundGroup: null,
    camera: null,
    communityMetrics: null,
    generatedAt: "",
    labelLayer: null,
    mapRoot: null,
    pointer: null,
    raycaster: null,
    regions: [],
    regionMeshes: new Map(),
    renderer: null,
    scene: null,
    selectedId: null,
    tickStartedAt: 0,
    viewMode: "angle",
  };

  const VIEW_MODES = new Set(["angle", "top"]);

  const $ = (selector) => document.querySelector(selector);

  function initParticleField() {
    const canvas = $("#pulse-particles");
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (!canvas || reduceMotion) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];
    let raf = 0;
    const palette = [
      "rgba(82, 166, 255, 0.72)",
      "rgba(255, 205, 132, 0.68)",
      "rgba(76, 226, 194, 0.66)",
      "rgba(230, 238, 248, 0.78)",
    ];

    function particleCount() {
      const area = window.innerWidth * window.innerHeight;
      return Math.max(44, Math.min(100, Math.floor(area / 15000)));
    }

    function createParticle() {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.14 - 0.025,
        size: 0.8 + Math.random() * 2.4,
        glow: 9 + Math.random() * 22,
        color: palette[Math.floor(Math.random() * palette.length)],
        phase: Math.random() * Math.PI * 2,
      };
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = Array.from({ length: particleCount() }, createParticle);
    }

    function drawConnections() {
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 138) continue;
          const alpha = (1 - dist / 138) * 0.22;
          const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          gradient.addColorStop(0, `rgba(88, 170, 255, ${alpha})`);
          gradient.addColorStop(1, `rgba(255, 210, 140, ${alpha})`);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    function frame(time) {
      ctx.clearRect(0, 0, width, height);
      drawConnections();
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;
        const shimmer = 0.55 + Math.sin(time * 0.0015 + p.phase) * 0.32;
        const radius = p.size * (0.8 + shimmer * 0.35);
        ctx.shadowBlur = p.glow;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.5 + shimmer * 0.34;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });
    raf = requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        raf = requestAnimationFrame(frame);
      }
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function num(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function formatNumber(value) {
    const n = Math.round(num(value));
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 10000) return `${(n / 1000).toFixed(0)}K`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  }

  function formatDate(value) {
    const dt = new Date(value || "");
    if (Number.isNaN(dt.valueOf())) return "--";
    return new Intl.DateTimeFormat("zh-Hant", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(dt);
  }

  function normalizeCards(payload) {
    const feed = payload?.feed && typeof payload.feed === "object" ? payload.feed : payload;
    const cards = Array.isArray(feed?.cards) ? feed.cards : [];
    state.generatedAt = String(feed?.generated_at || "");
    state.communityMetrics = feed?.community_metrics && typeof feed.community_metrics === "object" ? feed.community_metrics : null;
    return cards;
  }

  function cardMetrics(card) {
    const metrics = card?.metrics && typeof card.metrics === "object" ? card.metrics : {};
    return {
      likes: num(metrics.likes),
      replies: num(metrics.replies || metrics.comments || metrics.conversation_count),
    };
  }

  function scoreFromTotals(totals) {
    return totals.likes + totals.replies;
  }

  function metricAccountFor(region) {
    const accounts = state.communityMetrics?.accounts && typeof state.communityMetrics.accounts === "object"
      ? state.communityMetrics.accounts
      : {};
    return accounts[String(region.account || "").toLowerCase()] || null;
  }

  function metricDeltaFor(region) {
    const deltas = state.communityMetrics?.delta_24h_accounts && typeof state.communityMetrics.delta_24h_accounts === "object"
      ? state.communityMetrics.delta_24h_accounts
      : {};
    const row = deltas[String(region.account || "").toLowerCase()];
    return row && typeof row === "object" ? row : null;
  }

  function buildRegionData(cards) {
    const byAccount = new Map();
    for (const card of cards) {
      const account = String(card?.account || "").trim().toLowerCase();
      if (!account) continue;
      if (!byAccount.has(account)) byAccount.set(account, []);
      byAccount.get(account).push(card);
    }

    const rows = REGIONS.map((region) => {
      const cardsForRegion = (byAccount.get(region.account.toLowerCase()) || [])
        .slice()
        .sort((a, b) => new Date(b?.published_at || 0) - new Date(a?.published_at || 0));
      const totals = cardsForRegion.reduce((acc, card) => {
        const metrics = cardMetrics(card);
        acc.likes += metrics.likes;
        acc.replies += metrics.replies;
        acc.posts += 1;
        return acc;
      }, { likes: 0, replies: 0, posts: 0 });
      const feedTotals = metricAccountFor(region);
      const displayTotals = feedTotals
        ? {
          likes: Math.max(totals.likes, num(feedTotals.likes)),
          replies: Math.max(totals.replies, num(feedTotals.replies)),
          posts: Math.max(totals.posts, num(feedTotals.posts)),
        }
        : totals;
      const score = Math.max(scoreFromTotals(displayTotals), num(feedTotals?.score));
      const metricTotal = score;
      return {
        ...region,
        cards: cardsForRegion,
        totals: displayTotals,
        delta24: metricDeltaFor(region),
        score,
        metricTotal,
        latestAt: cardsForRegion[0]?.published_at || "",
      };
    });

    const maxScore = Math.max(1, ...rows.map((row) => row.score));
    return rows.map((row) => ({
      ...row,
      heat: Math.max(0.08, Math.min(1, row.score / maxScore)),
    }));
  }

  function projectLngLat(lng, lat) {
    const x = (lng - MAP_BOUNDS.centerLng) * MAP_BOUNDS.lngScale;
    const y = (lat - MAP_BOUNDS.centerLat) * MAP_BOUNDS.latScale;
    return new window.THREE.Vector2(x, y);
  }

  function lngLatToVector3(lng, lat, z = 0) {
    const point = projectLngLat(lng, lat);
    return new window.THREE.Vector3(point.x, point.y, z);
  }

  function outlineData(row) {
    return window.RENAISS_REGION_OUTLINES?.[row.id] || null;
  }

  function backgroundOutlineEntries() {
    const outlines = window.RENAISS_BACKGROUND_OUTLINES || {};
    return Object.entries(outlines)
      .filter(([, geojson]) => Array.isArray(geojson?.features) && geojson.features.length);
  }

  function polygonSets(geojson) {
    const sets = [];
    for (const feature of geojson?.features || []) {
      const geometry = feature?.geometry;
      if (!geometry) continue;
      if (geometry.type === "Polygon") sets.push(geometry.coordinates);
      if (geometry.type === "MultiPolygon") sets.push(...geometry.coordinates);
    }
    return sets;
  }

  function ringToPoints(ring) {
    const points = ring.map(([lng, lat]) => projectLngLat(lng, lat));
    if (points.length > 1) {
      const first = points[0];
      const last = points[points.length - 1];
      if (Math.abs(first.x - last.x) < 0.0001 && Math.abs(first.y - last.y) < 0.0001) {
        points.pop();
      }
    }
    return points;
  }

  function shapeFromRings(rings) {
    const outer = ringToPoints(rings[0] || []);
    if (outer.length < 3) return null;
    if (!window.THREE.ShapeUtils.isClockWise(outer)) outer.reverse();
    const shape = new window.THREE.Shape(outer);
    for (const ring of rings.slice(1)) {
      const hole = ringToPoints(ring);
      if (hole.length < 3) continue;
      if (window.THREE.ShapeUtils.isClockWise(hole)) hole.reverse();
      shape.holes.push(new window.THREE.Path(hole));
    }
    return shape;
  }

  function colorToHex(value) {
    return new window.THREE.Color(value);
  }

  function regionDepth(row) {
    return 0.22 + row.heat * 0.62;
  }

  function createRegionMaterials(row) {
    const color = colorToHex(row.color);
    const selected = row.id === state.selectedId;
    const top = new window.THREE.MeshPhysicalMaterial({
      color: color.clone().lerp(new window.THREE.Color("#e7f7ff"), selected ? 0.08 : 0.22),
      emissive: color.clone(),
      emissiveIntensity: selected ? 0.78 : 0.44,
      metalness: 0.22,
      roughness: selected ? 0.34 : 0.46,
      transparent: true,
      opacity: selected ? 0.99 : 0.9,
      clearcoat: 0.48,
      clearcoatRoughness: 0.34,
      side: window.THREE.DoubleSide,
    });
    const side = new window.THREE.MeshPhysicalMaterial({
      color: color.clone().multiplyScalar(selected ? 0.72 : 0.42),
      emissive: color.clone(),
      emissiveIntensity: selected ? 0.32 : 0.14,
      metalness: 0.16,
      roughness: 0.52,
      transparent: true,
      opacity: selected ? 0.92 : 0.78,
      side: window.THREE.DoubleSide,
    });
    return [top, side];
  }

  function updateRegionMaterials(entry, row) {
    const selected = row.id === state.selectedId;
    const base = colorToHex(row.color);
    const selectedLift = state.viewMode === "top"
      ? 0.58 + row.heat * 0.18
      : 0.52 + row.heat * 0.32;
    const targetLift = selected ? selectedLift : 0.006;
    const targetScale = selected ? (state.viewMode === "top" ? 1.035 : 1.016) : 1;
    const targetDepthScale = selected ? 1 : 0.025;
    entry.targetLift = targetLift;
    entry.targetScale = targetScale;
    entry.targetDepthScale = targetDepthScale;
    entry.targetGlowOpacity = selected ? 0.34 + row.heat * 0.2 : 0.1 + row.heat * 0.08;
    if (!entry.initialized) {
      entry.group.position.z = targetLift;
      entry.group.scale.set(targetScale, targetScale, targetDepthScale);
      entry.currentGlowOpacity = entry.targetGlowOpacity;
      entry.currentDepthScale = targetDepthScale;
      entry.initialized = true;
    }

    for (const mesh of entry.meshes) {
      const top = mesh.material[0];
      const side = mesh.material[1];
      top.color.copy(base).lerp(new window.THREE.Color("#e7f7ff"), selected ? 0.06 : 0.12);
      top.emissive.copy(base);
      top.emissiveIntensity = selected ? 0.82 : 0.28;
      top.opacity = selected ? 0.99 : 0.96;
      top.roughness = selected ? 0.34 : 0.48;
      side.color.copy(base).multiplyScalar(selected ? 0.72 : 0.42);
      side.emissive.copy(base);
      side.emissiveIntensity = selected ? 0.38 : 0.12;
      side.opacity = selected ? 0.92 : 0.76;
    }

    for (const fill of entry.fills || []) {
      fill.material.color.copy(base);
      fill.material.opacity = selected ? 0.66 : 0.34 + row.heat * 0.1;
    }

    for (const halo of entry.halos || []) {
      halo.material.color.copy(base);
      halo.material.opacity = entry.currentGlowOpacity ?? entry.targetGlowOpacity;
    }
    for (const outline of entry.outlines || []) {
      outline.material.color.copy(selected ? new window.THREE.Color("#ffffff").lerp(base, 0.32) : base);
      outline.material.opacity = selected ? 1 : 0.86;
    }
  }

  function createRegionGroup(row) {
    const geojson = outlineData(row);
    if (!geojson || !window.THREE) return null;
    const group = new window.THREE.Group();
    const fills = [];
    const meshes = [];
    const halos = [];
    const outlines = [];
    const depth = regionDepth(row);

    for (const rings of polygonSets(geojson)) {
      const shape = shapeFromRings(rings);
      if (!shape) continue;
      const geometry = new window.THREE.ExtrudeGeometry(shape, {
        bevelEnabled: true,
        bevelSegments: 4,
        bevelSize: 0.035,
        bevelThickness: 0.035,
        curveSegments: 10,
        depth,
        steps: 1,
      });
      geometry.computeVertexNormals();
      const mesh = new window.THREE.Mesh(geometry, createRegionMaterials(row));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.regionId = row.id;
      group.add(mesh);
      meshes.push(mesh);
      state.pickMeshes.push(mesh);

      const fill = new window.THREE.Mesh(
        new window.THREE.ShapeGeometry(shape),
        new window.THREE.MeshBasicMaterial({
          color: row.color,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
          side: window.THREE.DoubleSide,
        }),
      );
      fill.position.z = depth + 0.082;
      fill.userData.regionId = row.id;
      group.add(fill);
      fills.push(fill);
      state.pickMeshes.push(fill);

      const halo = new window.THREE.Mesh(
        new window.THREE.ShapeGeometry(shape),
        new window.THREE.MeshBasicMaterial({
          color: row.color,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          side: window.THREE.DoubleSide,
        }),
      );
      halo.position.z = -0.032;
      group.add(halo);
      halos.push(halo);

      const outlinePoints = ringToPoints(rings[0] || []).map((point) => new window.THREE.Vector3(point.x, point.y, depth + 0.064));
      if (outlinePoints.length >= 3) {
        outlinePoints.push(outlinePoints[0].clone());
        const outline = new window.THREE.Line(
          new window.THREE.BufferGeometry().setFromPoints(outlinePoints),
          new window.THREE.LineBasicMaterial({
            color: row.color,
            transparent: true,
            opacity: 0.88,
          }),
        );
        group.add(outline);
        outlines.push(outline);
      }
    }

    const labelPoint = lngLatToVector3(row.labelLng || row.lng, row.labelLat || row.lat, 0);

    group.userData.regionId = row.id;
    state.scene.add(group);
    const entry = {
      depth,
      fills,
      group,
      halos,
      initialized: false,
      labelPoint,
      labelEl: null,
      meshes,
      outlines,
      pulse: 0,
      currentGlowOpacity: 0,
      currentDepthScale: 0.025,
      targetGlowOpacity: 0,
      targetLift: 0,
      targetDepthScale: 0.025,
      targetScale: 1,
    };
    updateRegionMaterials(entry, row);
    return entry;
  }

  function createBaseScene() {
    const THREE = window.THREE;
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 27, 48, 40),
      new THREE.MeshPhysicalMaterial({
        color: "#f6fbff",
        emissive: "#ffffff",
        emissiveIntensity: 0.14,
        metalness: 0.02,
        roughness: 0.64,
        transparent: true,
        opacity: 0.94,
      }),
    );
    base.position.set(0, 0, -0.06);
    base.receiveShadow = true;
    state.scene.add(base);

    const lineMaterial = new THREE.LineBasicMaterial({
      color: "#9fb9d1",
      transparent: true,
      opacity: 0.18,
    });
    const points = [];
    for (let x = -22; x <= 22; x += 2) {
      points.push(new THREE.Vector3(x, -12.5, 0), new THREE.Vector3(x, 12.5, 0));
    }
    for (let y = -12; y <= 12; y += 2) {
      points.push(new THREE.Vector3(-22, y, 0), new THREE.Vector3(22, y, 0));
    }
    const grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), lineMaterial);
    grid.position.z = 0.005;
    state.scene.add(grid);
  }

  function createBackgroundRegions() {
    const THREE = window.THREE;
    if (!THREE || state.backgroundGroup) return;

    const group = new THREE.Group();
    const fillMaterial = new THREE.MeshPhysicalMaterial({
      color: "#c8d9e8",
      emissive: "#f7fbff",
      emissiveIntensity: 0.08,
      metalness: 0.04,
      roughness: 0.78,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });
    const borderMaterial = new THREE.LineBasicMaterial({
      color: "#435d72",
      transparent: true,
      opacity: 0.94,
    });

    for (const [, geojson] of backgroundOutlineEntries()) {
      for (const rings of polygonSets(geojson)) {
        const shape = shapeFromRings(rings);
        if (!shape) continue;
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), fillMaterial.clone());
        mesh.position.z = -0.015;
        mesh.receiveShadow = true;
        group.add(mesh);

        const outlinePoints = ringToPoints(rings[0] || []).map((point) => new THREE.Vector3(point.x, point.y, 0.006));
        if (outlinePoints.length >= 3) {
          outlinePoints.push(outlinePoints[0].clone());
          group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outlinePoints), borderMaterial));
        }
      }
    }

    state.backgroundGroup = group;
    state.scene.add(group);
  }

  function setCameraFromView() {
    if (!state.camera) return;
    if (state.viewMode === "top") {
      const topCenterY = 0.85;
      state.camera.fov = 32;
      state.camera.position.set(0, topCenterY - 0.01, 42);
      state.camera.up.set(0, 1, 0);
      state.camera.lookAt(0, topCenterY, 0);
    } else {
      state.camera.fov = 34;
      state.camera.position.set(0, -24, 17);
      state.camera.up.set(0, 0, 1);
      state.camera.lookAt(0, 0, 0.28);
    }
    state.camera.updateProjectionMatrix();
  }

  function renderThreeFrame() {
    if (!state.renderer || !state.scene || !state.camera) return;
    state.renderer.render(state.scene, state.camera);
    updateThreeLabels();
  }

  function startThreeLoop() {
    if (state.animationFrame || !state.renderer || !state.scene || !state.camera) return;
    state.tickStartedAt = performance.now();
    const tick = (time) => {
      state.animationFrame = requestAnimationFrame(tick);
      const phase = (time - state.tickStartedAt) * 0.001;
      for (const [id, entry] of state.regionMeshes.entries()) {
        const selected = id === state.selectedId;
        const liftEase = selected ? 0.14 : 0.09;
        const scaleEase = selected ? 0.13 : 0.08;
        entry.group.position.z += (entry.targetLift - entry.group.position.z) * liftEase;
        const scale = entry.group.scale.x + (entry.targetScale - entry.group.scale.x) * scaleEase;
        entry.currentDepthScale += (entry.targetDepthScale - entry.currentDepthScale) * (selected ? 0.14 : 0.1);
        entry.group.scale.set(scale, scale, entry.currentDepthScale);
        if (entry.pulse > 0.01) entry.pulse *= 0.9;
        if (entry.halos?.length) {
          const breath = selected ? (0.05 + Math.sin(phase * 2.2) * 0.025) : 0;
          const burst = entry.pulse * 0.24;
          entry.currentGlowOpacity += ((entry.targetGlowOpacity + breath + burst) - entry.currentGlowOpacity) * 0.12;
          const opacity = Math.max(0, Math.min(0.58, entry.currentGlowOpacity));
          const haloScale = 1 + (selected ? 0.018 : 0.006) + entry.pulse * 0.026;
          for (const halo of entry.halos) {
            halo.material.opacity = opacity;
            halo.scale.set(haloScale, haloScale, 1);
          }
          for (const outline of entry.outlines || []) {
            outline.material.opacity = selected ? Math.min(1, 0.92 + entry.pulse * 0.08) : 0.82;
          }
        }
      }
      state.renderer.render(state.scene, state.camera);
      updateThreeLabels();
    };
    state.animationFrame = requestAnimationFrame(tick);
  }

  function resizeThreeMap() {
    if (!state.renderer || !state.camera || !state.mapRoot) return;
    const rect = state.mapRoot.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    state.renderer.setSize(width, height, false);
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
    setCameraFromView();
    renderThreeFrame();
  }

  function ensureThreeMap() {
    const root = $("#pulse-real-map");
    if (!root) return false;
    if (state.renderer) return true;
    if (!window.THREE) {
      $("#map-provider-status").textContent = "Three.js unavailable";
      return false;
    }

    const THREE = window.THREE;
    state.mapRoot = root;
    state.labelLayer = $("#pulse-three-labels");
    state.scene = new THREE.Scene();
    state.scene.fog = new THREE.Fog("#f8fbff", 54, 96);
    state.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    state.pointer = new THREE.Vector2();
    state.raycaster = new THREE.Raycaster();
    state.pickMeshes = [];

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    root.appendChild(renderer.domElement);
    state.renderer = renderer;

    state.scene.add(new THREE.HemisphereLight("#ffffff", "#a9bfd4", 1.62));
    const key = new THREE.DirectionalLight("#ffffff", 3.4);
    key.position.set(-6, -10, 14);
    key.castShadow = true;
    key.shadow.mapSize.width = 1024;
    key.shadow.mapSize.height = 1024;
    state.scene.add(key);
    const rim = new THREE.PointLight("#71c7ff", 2.4, 42);
    rim.position.set(8, -8, 8);
    state.scene.add(rim);
    const warm = new THREE.PointLight("#ffce91", 1.45, 34);
    warm.position.set(-10, 4, 6);
    state.scene.add(warm);

    createBaseScene();
    createBackgroundRegions();
    setCameraFromView();
    resizeThreeMap();
    new ResizeObserver(resizeThreeMap).observe(root);
    bindThreeEvents();
    updateViewModeButtons();
    updateMapProviderStatus();
    renderThreeFrame();
    startThreeLoop();
    return true;
  }

  function updatePointer(event) {
    const rect = state.renderer.domElement.getBoundingClientRect();
    state.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    state.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickRegion(event) {
    if (!state.raycaster || !state.camera) return null;
    updatePointer(event);
    state.raycaster.setFromCamera(state.pointer, state.camera);
    const hits = state.raycaster.intersectObjects(state.pickMeshes, false);
    return hits[0]?.object?.userData?.regionId || null;
  }

  function bindThreeEvents() {
    const canvas = state.renderer.domElement;
    canvas.addEventListener("pointermove", (event) => {
      const regionId = pickRegion(event);
      canvas.style.cursor = regionId ? "pointer" : "default";
    });
    canvas.addEventListener("click", (event) => {
      const regionId = pickRegion(event);
      if (regionId) setActiveRegion(regionId);
    });
  }

  function createLabel(row) {
    const label = document.createElement("button");
    label.type = "button";
    label.className = "pulse-region-label";
    label.dataset.region = row.id;
    label.style.setProperty("--region-color", row.color);
    label.innerHTML = `
      <span class="pulse-region-label-name">${escapeHtml(row.label)}</span>
      <span class="pulse-region-label-score">聲量 ${formatNumber(row.score)}</span>
    `;
    label.setAttribute("aria-label", `${row.label} ${row.account}`);
    label.addEventListener("click", () => setActiveRegion(row.id));
    state.labelLayer.appendChild(label);
    return label;
  }

  function updateThreeLabels() {
    if (!state.camera || !state.labelLayer || !state.mapRoot) return;
    const rect = state.mapRoot.getBoundingClientRect();
    for (const [id, entry] of state.regionMeshes.entries()) {
      const row = state.regions.find((item) => item.id === id);
      if (!row) continue;
      const vector = entry.labelPoint.clone();
      vector.z = entry.group.position.z + (entry.depth * (entry.currentDepthScale || 1)) + 0.36;
      vector.project(state.camera);
      const visible = vector.z > -1 && vector.z < 1;
      const x = (vector.x * 0.5 + 0.5) * rect.width;
      const y = (-vector.y * 0.5 + 0.5) * rect.height;
      entry.labelEl.style.left = `${x}px`;
      entry.labelEl.style.top = `${y}px`;
      entry.labelEl.style.opacity = visible ? "1" : "0";
      entry.labelEl.classList.toggle("is-active", id === state.selectedId);
      entry.labelEl.style.setProperty("--region-color", row.color);
      const scoreEl = entry.labelEl.querySelector(".pulse-region-label-score");
      if (scoreEl) scoreEl.textContent = `聲量 ${formatNumber(row.score)}`;
    }
  }

  function setActiveRegion(id) {
    const nextId = id || state.selectedId;
    if (!nextId) return;
    const changed = nextId !== state.selectedId;
    state.selectedId = nextId;
    render();
    const entry = state.regionMeshes.get(state.selectedId);
    if (changed && entry) entry.pulse = 1;
  }

  function updateViewModeButtons() {
    for (const button of document.querySelectorAll("[data-map-view]")) {
      const active = button.dataset.mapView === state.viewMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function updateMapProviderStatus() {
    const status = $("#map-provider-status");
    if (!status) return;
    const updatedAt = state.communityMetrics?.updated_at || state.generatedAt;
    status.textContent = `更新時間 ${updatedAt ? formatDate(updatedAt) : "--"}`;
  }

  function setViewMode(mode) {
    if (!VIEW_MODES.has(mode)) return;
    state.viewMode = mode;
    updateViewModeButtons();
    updateMapProviderStatus();
    setCameraFromView();
    for (const row of state.regions) {
      const entry = state.regionMeshes.get(row.id);
      if (entry) updateRegionMaterials(entry, row);
    }
    renderThreeFrame();
    const active = state.regionMeshes.get(state.selectedId);
    if (active) active.pulse = Math.max(active.pulse || 0, 0.72);
  }

  function renderThreeMap() {
    if (!ensureThreeMap()) return;
    for (const row of state.regions) {
      let entry = state.regionMeshes.get(row.id);
      if (!entry) {
        entry = createRegionGroup(row);
        if (!entry) continue;
        entry.labelEl = createLabel(row);
        state.regionMeshes.set(row.id, entry);
      }
      updateRegionMaterials(entry, row);
    }
    updateThreeLabels();
    renderThreeFrame();
  }

  function renderSummary() {
    const hasMetrics = state.regions.some((row) => row.metricTotal > 0);
    const computedTotal = state.regions.reduce((sum, row) => sum + row.score, 0);
    const feedTotal = num(state.communityMetrics?.total_score);
    const total = Math.max(computedTotal, feedTotal);
    const delta = state.communityMetrics?.delta_24h_score;
    const deltaText = delta === null || delta === undefined || delta === "" ? "24h --" : `24h ${delta >= 0 ? "+" : ""}${formatNumber(delta)}`;
    $("#pulse-data-status").textContent = hasMetrics
      ? `每小時更新 · 總聲量 ${formatNumber(total)} · ${deltaText}`
      : "每小時更新 · 等待 X 互動數";
    updateMapProviderStatus();
  }

  function regionButton(row) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pulse-region-button${row.id === state.selectedId ? " is-active" : ""}`;
    button.dataset.region = row.id;
    button.style.setProperty("--heat", row.heat.toFixed(3));
    button.style.setProperty("--region-color", row.color);
    button.innerHTML = `
      <span class="region-dot" aria-hidden="true"></span>
      <span class="region-name">
        <strong>${escapeHtml(row.label)} · ${escapeHtml(row.region)}</strong>
        <span>@${escapeHtml(row.account)} · ${row.totals.posts} posts</span>
      </span>
      <span class="region-score">${formatNumber(row.score)}</span>
    `;
    return button;
  }

  function renderRegionList() {
    const list = $("#pulse-region-list");
    if (!list) return;
    list.innerHTML = "";
    state.regions
      .slice()
      .sort((a, b) => b.score - a.score)
      .forEach((row) => list.appendChild(regionButton(row)));
  }

  function metricBox(label, value) {
    return `
      <div class="metric-box">
        <span>${formatNumber(value)}</span>
        <em>${label}</em>
      </div>
    `;
  }

  function renderMapCallout(row) {
    const callout = $("#pulse-map-callout");
    if (!callout) return;
    if (!row) {
      callout.style.removeProperty("--region-color");
      callout.innerHTML = `
        <strong>點選地區查看聲量</strong>
        <span>社群地區先與底圖對齊，點選後才會浮起發光。</span>
      `;
      return;
    }
    callout.style.setProperty("--region-color", row.color);
    const deltaText = row.delta24?.score === null || row.delta24?.score === undefined ? "24h --" : `24h ${row.delta24.score >= 0 ? "+" : ""}${formatNumber(row.delta24.score)}`;
    callout.innerHTML = `
      <strong>${escapeHtml(row.label)}聲量 ${formatNumber(row.score)}</strong>
      <span>@${escapeHtml(row.account)} · ❤️${formatNumber(row.totals.likes)} · 💬${formatNumber(row.totals.replies)} · ${deltaText}</span>
    `;
  }

  function renderSelected() {
    const row = state.regions.find((item) => item.id === state.selectedId);
    if (!row) {
      renderMapCallout(null);
      $("#pulse-selected-title").textContent = "選擇地區";
      $("#pulse-selected-account").textContent = "點選地圖或列表";
      $("#pulse-selected-card").innerHTML = `<p class="pulse-empty">點選地區後會浮起並顯示聲量、互動數與近期貼文。</p>`;
      $("#pulse-recent-posts").innerHTML = `<p class="pulse-empty">尚未選擇地區。</p>`;
      return;
    }
    renderMapCallout(row);
    $("#pulse-selected-title").textContent = `${row.label} · ${row.region}`;
    $("#pulse-selected-account").textContent = `@${row.account}`;
    $("#pulse-selected-card").innerHTML = `
      <div class="selected-region-top">
        <div class="selected-region-title">
          <strong>${escapeHtml(row.label)}</strong>
          <span>@${escapeHtml(row.account)} · Latest ${formatDate(row.latestAt)}</span>
        </div>
        <div class="selected-score">${formatNumber(row.score)}</div>
      </div>
      <div class="metric-grid">
        ${metricBox("Likes", row.totals.likes)}
        ${metricBox("Comments", row.totals.replies)}
        ${metricBox("24h Change", row.delta24?.score ?? 0)}
        ${metricBox("Posts", row.totals.posts)}
      </div>
    `;

    const posts = row.cards.slice(0, 5);
    $("#pulse-recent-posts").innerHTML = posts.length
      ? posts.map((card) => {
        const metrics = cardMetrics(card);
        const title = String(card?.title || card?.summary || "Untitled update").trim();
        const url = String(card?.url || "#").trim() || "#";
        return `
          <a class="pulse-post-row" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">
            <strong>${escapeHtml(title)}</strong>
            <span>${formatDate(card?.published_at)} · ❤️${formatNumber(metrics.likes)} 💬${formatNumber(metrics.replies)}</span>
          </a>
        `;
      }).join("")
      : `<p class="pulse-empty">目前沒有這個區域帳號的可用貼文。</p>`;
  }

  function render() {
    renderSummary();
    renderThreeMap();
    renderRegionList();
    renderSelected();
  }

  async function loadPulse() {
    $("#pulse-data-status").textContent = "同步中 · 每小時更新 · 按讚+留言";
    try {
      const response = await fetch("./api/intel/feed?lang=zh-Hant", { cache: "no-store" });
      if (!response.ok) throw new Error(`feed ${response.status}`);
      const payload = await response.json();
      const cards = normalizeCards(payload);
      state.regions = buildRegionData(cards);
      if (!state.regions.some((row) => row.id === state.selectedId)) state.selectedId = null;
      render();
    } catch (error) {
      $("#pulse-data-status").textContent = `Feed error: ${error.message}`;
      $("#pulse-region-list").innerHTML = `<p class="pulse-empty">無法讀取目前 feed。</p>`;
      $("#pulse-selected-card").innerHTML = `<p class="pulse-empty">請稍後重試。</p>`;
      $("#pulse-recent-posts").innerHTML = "";
    }
  }

  document.addEventListener("click", (event) => {
    const regionButtonEl = event.target.closest("[data-region]");
    if (!regionButtonEl) return;
    setActiveRegion(regionButtonEl.dataset.region);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const region = event.target.closest?.("[data-region]");
    if (!region) return;
    event.preventDefault();
    setActiveRegion(region.dataset.region);
  });

  $("#pulse-refresh")?.addEventListener("click", loadPulse);
  document.querySelectorAll("[data-map-view]").forEach((button) => {
    button.addEventListener("click", () => setViewMode(button.dataset.mapView));
  });
  updateViewModeButtons();
  initParticleField();
  loadPulse();
  window.setInterval(loadPulse, REFRESH_INTERVAL_MS);
})();
