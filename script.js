gsap.registerPlugin(ScrollTrigger);

/* ─── GSAP Page Animations ─── */

gsap.to(".navbar", {
    opacity: 1, duration: 1,
    scrollTrigger: { trigger: ".hero", start: "top top", end: "+=200", scrub: 1 }
});

gsap.from(".about-container", {
    opacity: 0, y: 100, duration: 1,
    scrollTrigger: { trigger: ".about", start: "top 80%" }
});

gsap.from(".timeline-item", {
    opacity: 0, y: 80, stagger: 0.2, duration: 1,
    scrollTrigger: { trigger: ".roadmap", start: "top 80%" }
});

gsap.from(".ticket-card", {
    opacity: 0, scale: 0.9, duration: 1,
    scrollTrigger: { trigger: ".tickets", start: "top 80%" }
});


/* ══════════════════════════════════════════
   TRUE 3D SPEAKER CAROUSEL
   Strategy: each .sc-item lives in 3D space.
   We set their individualrotateY + translateZ
   inline, then transition to a new set when
   the active index changes. No stage rotation
   — individual item transforms give true
   per-card 3D depth control.
══════════════════════════════════════════ */

const SPEAKERS = [
    {
        name:        "GEO JOSEPH",
        displayName: "Geo Joseph",
        role:        "Digital Content Creator",
        desc:        "Visionary creator behind M4 Tech, inspiring millions through innovation and technology."
    },
    {
        name:        "JITHIN LAAL",
        displayName: "Jithin Laal",
        role:        "Film Director",
        desc:        "Cinematic storyteller redefining boundaries in Malayalam cinema."
    },
    {
        name:        "VINEETHA KOSHY",
        displayName: "Vineetha Koshy",
        role:        "Actress & Counselor",
        desc:        "An authentic voice in performance and mental health advocacy."
    }
];

const stage   = document.getElementById('sc-stage');
const items   = stage ? Array.from(stage.querySelectorAll('.sc-item')) : [];
const prevBtn = document.getElementById('sc-prev');
const nextBtn = document.getElementById('sc-next');

let activeSpeakerIndex = 0; // shared with particle.js
let autoplayTimer;
const N = items.length;

function getCarouselMetrics() {
    const width = window.innerWidth;

    if (width <= 640) {
        return {
            ringZ: 160,
            frontScale: 1,
            sideScale: 0.72,
            backScale: 0.52,
            sideOpacity: 0.3,
            backOpacity: 0.08,
            sideBlur: 1.5,
            backBlur: 3.5
        };
    }

    if (width <= 900) {
        return {
            ringZ: 220,
            frontScale: 1.04,
            sideScale: 0.76,
            backScale: 0.54,
            sideOpacity: 0.4,
            backOpacity: 0.14,
            sideBlur: 2,
            backBlur: 4
        };
    }

    return {
        ringZ: 380,
        frontScale: 1.08,
        sideScale: 0.78,
        backScale: 0.55,
        sideOpacity: 0.5,
        backOpacity: 0.18,
        sideBlur: 2,
        backBlur: 5
    };
}

/**
 * Compute and apply the 3D transform for every card relative to the
 * current activeSpeakerIndex. Card at position 0 (front) gets
 * rotateY(0) translateZ(RING_Z) — i.e. pushed toward the viewer.
 */
function positionCards() {
    const metrics = getCarouselMetrics();

    items.forEach((card, i) => {
        // Angular offset for this card relative to the active one
        const relPos     = (i - activeSpeakerIndex + N) % N;
        // Map to angle on the ring: 0 = front, distribute the rest around
        const angleDeg   = (relPos / N) * 360;
        const angleRad   = (angleDeg * Math.PI) / 180;

        // Translate to position on the ring
        const tx   = Math.sin(angleRad) * metrics.ringZ;
        const tz   = Math.cos(angleRad) * metrics.ringZ - metrics.ringZ; // negative = further back

        // Depth-based appearance
        const isFront   = relPos === 0;
        const isSide    = relPos === 1 || relPos === N - 1;
        const scale     = isFront ? metrics.frontScale : isSide ? metrics.sideScale : metrics.backScale;
        const opacity   = isFront ? 1    : isSide ? metrics.sideOpacity : metrics.backOpacity;
        const blurPx    = isFront ? 0    : isSide ? metrics.sideBlur : metrics.backBlur;
        const zIndex    = isFront ? 10   : isSide ? 5    : 1;

        card.style.transform  =
            `perspective(1400px) translateX(${tx}px) translateZ(${tz}px) scale(${scale})`;
        card.style.opacity    = opacity;
        card.style.filter     = blurPx > 0 ? `blur(${blurPx}px) brightness(0.55)` : 'none';
        card.style.zIndex     = zIndex;

        // Active class for CSS glow/border
        card.classList.toggle('is-active', isFront);
    });
}

let _morphTimer = null;

function setActiveSpeaker(idx) {
    activeSpeakerIndex = ((idx % N) + N) % N;
    positionCards();

    // Only update particle text when particle.js is in 'speaker' mode.
    // window.particleMode is kept in sync by particle.js via setParticleMode().
    if (window.particleMode === 'speaker' && window.triggerTextMorph) {
        // Small delay = premium feel; also debounces rapid prev/next clicks
        clearTimeout(_morphTimer);
        _morphTimer = setTimeout(() => {
            window.triggerTextMorph(SPEAKERS[activeSpeakerIndex].name);
        }, 120);
    }
}


/* Navigation */
function nextSpeaker() { setActiveSpeaker(activeSpeakerIndex + 1); }
function prevSpeaker() { setActiveSpeaker(activeSpeakerIndex - 1); }

items.forEach((card, i) => {
    card.addEventListener('click', () => {
        if (i !== activeSpeakerIndex) {
            setActiveSpeaker(i);
            resetAutoplay();
        }
    });
});

if (nextBtn) nextBtn.addEventListener('click', () => { nextSpeaker(); resetAutoplay(); });
if (prevBtn) prevBtn.addEventListener('click', () => { prevSpeaker(); resetAutoplay(); });

function startAutoplay() {
    autoplayTimer = setInterval(nextSpeaker, 5000);
}
function resetAutoplay() {
    clearInterval(autoplayTimer);
    startAutoplay();
}

// Boot — position cards, do NOT trigger particle morph yet.
positionCards();
startAutoplay();
window.addEventListener('resize', positionCards);

// Called by particle.js when scroll-center condition is met (mode enters 'speaker').
// This is the single authoritative trigger for the name morph.
window.onParticleModeEnterSpeaker = function () {
    if (window.triggerTextMorph) {
        window.triggerTextMorph(SPEAKERS[activeSpeakerIndex].name);
    }
};
