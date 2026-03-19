(() => {
  const root = document.documentElement;
  const intro = document.getElementById("intro");
  const logoImages = Array.from(document.querySelectorAll(".logo-half img"));

  if (!intro) {
    return;
  }

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const updateAnimation = () => {
    const rect = intro.getBoundingClientRect();
    const total = Math.max(intro.offsetHeight - window.innerHeight, 1);
    const progress = clamp(-rect.top / total, 0, 1);

    const split = clamp((progress - 0.06) / 0.68, 0, 1);
    const introFade = clamp(1 - clamp((progress - 0.58) / 0.32, 0, 1), 0, 1);
    const homeProgress = clamp((progress - 0.42) / 0.5, 0, 1);
    const cameraZoom = 1 + progress * 1.65;

    root.style.setProperty("--split", split.toFixed(4));
    root.style.setProperty("--intro-fade", introFade.toFixed(4));
    root.style.setProperty("--home-opacity", homeProgress.toFixed(4));
    root.style.setProperty("--home-rise", `${(1 - homeProgress) * 80}px`);
    root.style.setProperty("--camera-zoom", cameraZoom.toFixed(4));
  };

  let ticking = false;
  const onScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateAnimation();
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", updateAnimation);

  const logoCandidates = [
    "assets/tedl.jpeg",
    "assets/tedl.jpg",
    "assets/tedl.png",
    "assets/tedl.webp"
  ];

  const preload = (src) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(src);
      image.onerror = reject;
      image.src = src;
    });

  (async () => {
    for (const src of logoCandidates) {
      try {
        const found = await preload(src);
        logoImages.forEach((img) => {
          img.src = found;
        });
        break;
      } catch {
        // Continue to next candidate.
      }
    }
  })();

  updateAnimation();
})();
