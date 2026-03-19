const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const canvasFront = document.getElementById('particle-canvas-front');
const ctxFront = canvasFront.getContext('2d', { willReadFrequently: true });
const logoImage = new Image();

let particlesArray = [];
let ambientParticlesArray = []; // Secondary layer

let mouse = {
    x: undefined,
    y: undefined,
    radius: 50 // Decreased radius of interaction for tighter scattering
};

let isOrbitMode = false;

function isMobile() {
    return window.innerWidth <= 768;
}

// Interactive roadmap targets
let activeCard = null;
let orbitTarget = null;

// ── Particle mode state ──
// 'default' → particles form the X logo and float freely
// 'speaker' → particles morph into the active speaker's name
// 'transition' → particles returning from text back to X shape
let particleMode = 'default';

// Sync particleMode to window so script.js can read window.particleMode
function setParticleMode(mode) {
    if (particleMode !== mode) {
        particleMode = mode;
    }
    window.particleMode = mode;
}
setParticleMode('default'); // initialise window.particleMode immediately

// Text Morphing State
let textTargets = [];
let activeText = "";
const textCanvas = document.createElement('canvas');
const textCtx = textCanvas.getContext('2d');

// Handle resize
window.addEventListener('resize', function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvasFront.width = window.innerWidth;
    canvasFront.height = window.innerHeight;
    init();
});

// Setup canvas size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
canvasFront.width = window.innerWidth;
canvasFront.height = window.innerHeight;

// Track Mouse Movement
window.addEventListener('mousemove', function(event) {
    if (isOrbitMode) return;
    mouse.x = event.x;
    mouse.y = event.y;
});

window.addEventListener('touchmove', function(event) {
    if (isOrbitMode) return;
    const touch = event.touches[0];
    if (!touch) return;
    mouse.x = touch.clientX;
    mouse.y = touch.clientY;
}, { passive: true });

// When mouse leaves the window, stop interaction
window.addEventListener('mouseout', function() {
    mouse.x = undefined;
    mouse.y = undefined;
});

// Particle Class
class Particle {
    constructor(x, y, r, g, b) {
        // Base positions mapped from the image
        this.baseX = x;
        this.baseY = y;

        // Permanent home positions (X logo) — never overwritten
        this.homeX = x;
        this.homeY = y;

        // Current actual positions
        this.x = x;
        this.y = y;
        
        // Target Text positions
        this.targetTextX = undefined;
        this.targetTextY = undefined;
        this.morphLerp = 0;
        
        // Fast pre-computed aesthetics
        this.r = r;
        this.g = g;
        this.b = b;
        this.size = Math.random() * 2 + 1; // Smooth, consistently sized particles
        this.currentSize = this.size;
        this.currentOpacity = 1;
        this.isFront = true; // Depth flag for layered drawing
        this.vx = 0;
        this.vy = 0;
        
        this.density = (Math.random() * 15) + 5; // Mass for scattering calculations
        
        // Setup for smooth zero gravity drift
        this.angle = Math.random() * Math.PI * 2; // Random starting angle
        this.spinSpeed = Math.random() * 0.01 + 0.005; // Gentle, slow breathing
        this.driftRange = Math.random() * 6 + 2; // Limit how far they wander from the center
        
        // INTERACTIVE ORBIT properties (Cinematic 3D Saturn Ring)
        this.canOrbit = Math.random() < 0.25; // 25% of rendering particles can orbit
        this.orbitLerp = 0; // State variable for spiraling transition
    }

    draw(context) {
        context.fillStyle = `rgba(${this.r}, ${this.g}, ${this.b}, ${this.currentOpacity})`;
        context.beginPath();
        // Use exact PI * 2 for a full smooth circle to prevent shape flickering
        context.arc(this.x, this.y, this.currentSize, 0, Math.PI * 2);
        context.closePath();
        context.fill();
        
        // Soft cinematic glow for orbiting particles in the foreground
        if (this.orbitLerp > 0.1 && this.isFront && this.canOrbit) {
            context.fillStyle = `rgba(235, 0, 40, ${this.currentOpacity * 0.3 * this.orbitLerp})`;
            context.beginPath();
            context.arc(this.x, this.y, this.currentSize * 2.5, 0, Math.PI * 2);
            context.closePath();
            context.fill();
        }
    }

    update() {
        // Smooth sine wave zero gravity breathing
        this.angle += this.spinSpeed;
        const driftX = Math.cos(this.angle) * this.driftRange;
        const driftY = Math.sin(this.angle) * this.driftRange;

        // Base resting target: home X position + gentle drift
        let targetX = this.homeX + driftX;
        let targetY = this.homeY + driftY;

        // ** Text Morphing Logic **
        // morphLerp goes 0→1 when morphing TO text, 1→0 when returning to X
        const morphSpeed = particleMode === 'speaker' ? 0.025 : 0.018;
        if (this.targetTextX !== undefined && activeText !== '') {
            // Moving TOWARD text target
            this.morphLerp += morphSpeed;
            if (this.morphLerp > 1) this.morphLerp = 1;
        } else {
            // Moving BACK to X shape
            this.morphLerp -= morphSpeed;
            if (this.morphLerp < 0) this.morphLerp = 0;
        }

        if (this.morphLerp > 0) {
            // easeInOutCubic — cinematic feel
            const t = this.morphLerp;
            const ease = t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2;

            if (this.targetTextX !== undefined && activeText !== '') {
                // ── MOVING TOWARD TEXT ──
                // Shimmer only when fully settled
                let shimmerX = 0;
                let shimmerY = 0;
                if (this.morphLerp >= 0.98) {
                    shimmerX = Math.sin(Date.now() * 0.0015 + this.x * 0.012) * 1.5;
                    shimmerY = Math.cos(Date.now() * 0.0015 + this.y * 0.012) * 1.5;
                }
                const tx = this.targetTextX + shimmerX;
                const ty = this.targetTextY + shimmerY;
                targetX = targetX + (tx - targetX) * ease;
                targetY = targetY + (ty - targetY) * ease;
            } else {
                // ── RETURNING TO X: lerp from current toward home ──
                // homeX/homeY are the particle's permanent X logo positions
                const hx = this.homeX + driftX;
                const hy = this.homeY + driftY;
                // Use (1 - ease) so as morphLerp falls from 1→0, pull increases toward home
                targetX = this.x + (hx - this.x) * (1 - ease + 0.1);
                targetY = this.y + (hy - this.y) * (1 - ease + 0.1);
            }

            this.currentSize = this.size * (1 + (1 - ease) * 0.4);
        } else {
            // Fully back in default mode — restore base size and full opacity
            this.currentSize  = this.size;
            this.currentOpacity = 1;
        }

        // Opacity always at least 1 outside of orbit mode
        if (this.orbitLerp === 0) {
            this.currentOpacity = 1;
        }

        // ** Roadmap Orbit Hover Interaction **
        if (this.canOrbit && orbitTarget) {
            this.orbitLerp += 0.015; // Smooth cinematic transition speed
            if (this.orbitLerp > 1) this.orbitLerp = 1;
            
            this.orbitAngle += this.orbitSpeed;
            // Spiral effect: start massive globally and shrink down organically to the target radius
            const currentRadius = orbitTarget.radius + this.orbitRadiusOffset + (1 - this.orbitLerp) * 600;
            
            let rx = currentRadius;
            let ry = currentRadius * this.orbitSquash;

            let ex = Math.cos(this.orbitAngle) * rx;
            let ey = Math.sin(this.orbitAngle) * ry;

            // Tilt the ellipse path slightly (Saturn ring)
            let rotatedX = ex * Math.cos(this.orbitTilt) - ey * Math.sin(this.orbitTilt);
            let rotatedY = ex * Math.sin(this.orbitTilt) + ey * Math.cos(this.orbitTilt);

            const orbitX = orbitTarget.x + rotatedX;
            const orbitY = orbitTarget.y + rotatedY;
            
            // Cubic ease transition provides incredibly smooth visual spiraling
            const ease = this.orbitLerp * this.orbitLerp * (3 - 2 * this.orbitLerp);
            targetX = targetX + (orbitX - targetX) * ease;
            targetY = targetY + (orbitY - targetY) * ease;
            
            // 3D Depth illusion: Z-axis scaling and opacity
            let depth = Math.sin(this.orbitAngle); // ranges -1 to 1
            this.isFront = depth > 0;
            
            let targetSize = this.size * (1 + depth * 0.4); // smaller in back, larger in front
            let targetOpacity = 0.5 + depth * 0.5; // fades out in the back
            
            this.currentSize = this.size + (targetSize - this.size) * ease;
            this.currentOpacity = 1 + (targetOpacity - 1) * ease;
            
        } else if (this.canOrbit && !orbitTarget && this.orbitLerp > 0) {
            // Smoothly lerp visuals back down when exiting hover
            this.orbitLerp -= 0.015; 
            if (this.orbitLerp < 0) this.orbitLerp = 0;
            
            // Unwind size and opacity organically
            this.currentSize = this.size + (this.currentSize - this.size) * this.orbitLerp;
            this.currentOpacity = 1 + (this.currentOpacity - 1) * this.orbitLerp;
            // Native smooth engine will handle returning the X/Y coordinates physics completely organically
        }

        if (isOrbitMode) {
            this.vx *= 0.9;
            this.vy *= 0.9;
            this.x += (targetX - this.x) * 0.05;
            this.y += (targetY - this.y) * 0.05;
            return;
        }

        // Mouse collision forces
        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouse.radius && mouse.x !== undefined) {
            // Repel from mouse smoothly based on distance
            let forceDirectionX = dx / distance;
            let forceDirectionY = dy / distance;
            let force = (mouse.radius - distance) / mouse.radius;
            
            let directionX = forceDirectionX * force * this.density;
            let directionY = forceDirectionY * force * this.density;

            this.x -= directionX;
            this.y -= directionY;
        } else {
            // Smoothly ease back to the breathing target position if previously moved
            // A smaller dampening factor (0.05) creates a very smooth return spring
            this.x += (targetX - this.x) * 0.05;
            this.y += (targetY - this.y) * 0.05;
        }
    }
}

// Function to generate text coordinates with precise, dense sampling
window.triggerTextMorph = function(text) {
    if (isMobile()) return;
    if (activeText === text) return;
    activeText = text;
    
    textTargets = [];
    
    // Setup text canvas (full screen resolution)
    textCanvas.width = canvas.width;
    textCanvas.height = canvas.height;
    textCtx.clearRect(0, 0, canvas.width, canvas.height);

    // Adaptive font size — fit long names inside the available width
    const maxTextWidth = Math.min(canvas.width * 0.86, 1400);
    let fontSize = Math.min(Math.floor(canvas.width / (text.length * 0.52)), 160);
    textCtx.font = `900 ${fontSize}px Inter, sans-serif`;
    while (fontSize > 56 && textCtx.measureText(text).width > maxTextWidth) {
        fontSize -= 4;
        textCtx.font = `900 ${fontSize}px Inter, sans-serif`;
    }
    textCtx.textAlign = 'center';
    textCtx.textBaseline = 'middle';

    // White fill for clean alpha sampling
    textCtx.fillStyle = 'white';
    textCtx.fillText(text, canvas.width / 2, canvas.height * 0.28);

    // Step 2 = maximum density, readable shapes even with large font
    const step = 2;
    const imgData = textCtx.getImageData(0, 0, canvas.width, canvas.height).data;

    for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
            const a = imgData[(y * canvas.width + x) * 4 + 3];
            if (a > 100) {
                textTargets.push({ x, y });
            }
        }
    }

    // Shuffle for organic morph appearance
    textTargets.sort(() => Math.random() - 0.5);

    // Assign every particle a target — wrap if fewer targets than particles
    const tLen = textTargets.length;
    if (tLen === 0) return;

    particlesArray.forEach((p, i) => {
        const t = textTargets[i % tLen];
        p.targetTextX = t.x;
        p.targetTextY = t.y;
    });
};

// Secondary layer: Ambient Particles
class AmbientParticle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5; // Slightly larger sizes
        
        // Higher opacity dim red or soft white
        const opacity = Math.random() * 0.4 + 0.1; // 10% to 50% opacity
        this.color = Math.random() > 0.6 ? `rgba(235, 0, 40, ${opacity})` : `rgba(255, 255, 255, ${opacity})`;
        
        // Slow drifting motion
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4;
    }

    draw(context) {
        context.fillStyle = this.color;
        context.beginPath();
        context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        context.closePath();
        context.fill();
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Wrap around screen
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;
    }
}

// Initialize particles based on the loaded Image
function init() {
    particlesArray = [];
    
    // Clear canvas before scanning
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Scale image to cover about 85% of screen depending on ratio
    const scale = Math.min(
        (canvas.width * 0.85) / logoImage.width,
        (canvas.height * 0.85) / logoImage.height
    );
    
    const drawWidth = logoImage.width * scale;
    const drawHeight = logoImage.height * scale;
    // Center it, offset slightly higher to sit beautifully behind the hero text
    const drawX = (canvas.width - drawWidth) / 2;
    const drawY = (canvas.height - drawHeight) / 2 - 50;
    
    // Draw the actual image to the hidden context and scan its pixels
    ctx.drawImage(logoImage, drawX, drawY, drawWidth, drawHeight);

    // Retrieve pixel data
    const textCoordinates = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pd = textCoordinates.data;
    
    // VERY IMPORTANT: Clear the canvas immediately after slicing pixel data
    // so the original solid image is completely hidden before particles spawn
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Step size controls particle density: 4 gives ~5x density of the previous step=6.
    const step = 4; 
    
    for (let y = 0, y2 = textCoordinates.height; y < y2; y += step) {
        for (let x = 0, x2 = textCoordinates.width; x < x2; x += step) {
            const index = (y * 4 * textCoordinates.width) + (x * 4);
            const alpha = pd[index + 3];
            const r = pd[index];
            const g = pd[index + 1];
            const b = pd[index + 2];
            
            const brightness = (r + g + b) / 3;

            // PERFORMANCE FIX: Only create particles if the pixel is visible AND isn't completely black.
            // A JPEG has no alpha (always 255), so a black background would create millions of invisible black particles!
            if (alpha > 50 && brightness > 15) {
                // Pass RGB components individually for dynamic opacity tracking
                particlesArray.push(new Particle(x, y, r, g, b));
            }
        }
    }

    // Initialize the ambient secondary background particles
    ambientParticlesArray = [];
    const ambientCount = Math.floor((canvas.width * canvas.height) / 2500); // 4x more particles
    for (let i = 0; i < ambientCount; i++) {
        ambientParticlesArray.push(new AmbientParticle());
    }

    // Mathematical logic for a perfectly distributed cinematic 360-degree Saturn Ring
    let orbitingParticles = particlesArray.filter(p => p.canOrbit);
    let totalOrbit = orbitingParticles.length;
    let globalTilt = Math.PI / 8; // Global baseline tilt for the Saturn ring (tilted up diagonally)
    
    for (let i = 0; i < totalOrbit; i++) {
        let p = orbitingParticles[i];
        p.orbitAngle = (i / totalOrbit) * Math.PI * 2; // EXACT fractional spacing prevents any clumping!
        p.orbitSpeed = 0.003; // Extremely slow, cinematic orbit. Identical speed maintains the perfect ring lock.
        p.orbitRadiusOffset = (Math.random() * 20) - 10; // Maintains a very tight cinematic ring thickness
        p.orbitTilt = globalTilt + (Math.random() * 0.04 - 0.02); // Just enough imperfection so it looks organic
        p.orbitSquash = 0.5 + (Math.random() * 0.05); // Vertical compression to ~50%
    }
}

// Animation Loop
function animate() {
    // Dynamic coordinate tracking ensures orbits follow the card even while user scrolls!
    if (activeCard && !isMobile()) {
        const rect = activeCard.getBoundingClientRect();
        orbitTarget = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            radius: Math.max(rect.width, rect.height) * 0.6 // orbit outside card bounds
        };
        isOrbitMode = true;
        mouse.x = undefined;
        mouse.y = undefined;
    } else {
        orbitTarget = null;
        isOrbitMode = false;
    }

    // Motion blur/trailing effect using destination-out
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Smooth fade trails
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Reset to source-over for standard particle drawing
    ctx.globalCompositeOperation = 'source-over';
    
    // Front canvas motion blur
    ctxFront.globalCompositeOperation = 'destination-out';
    ctxFront.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctxFront.fillRect(0, 0, canvasFront.width, canvasFront.height);
    // Reset front canvas
    ctxFront.globalCompositeOperation = 'source-over';

    // 1. Update Physics for ALL particles
    for (let i = 0; i < ambientParticlesArray.length; i++) {
        ambientParticlesArray[i].update();
    }
    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
    }
    
    // 2. Layering: Draw Ambient Particles (Lowest Background Layer)
    for (let i = 0; i < ambientParticlesArray.length; i++) {
        ambientParticlesArray[i].draw(ctx);
    }
    
    // 3. Layering: Draw Back-layer Orbiting particles and Static particles
    for (let i = 0; i < particlesArray.length; i++) {
        if (!particlesArray[i].canOrbit || !particlesArray[i].isFront || particlesArray[i].orbitLerp === 0) {
            particlesArray[i].draw(ctx);
        }
    }
    
    // 4. Layering: Draw Front-layer Orbiting particles (Highest Z-index, physically rendered above the DOM)
    for (let i = 0; i < particlesArray.length; i++) {
        if (particlesArray[i].canOrbit && particlesArray[i].isFront && particlesArray[i].orbitLerp > 0) {
            particlesArray[i].draw(ctxFront);
        }
    }
    
    // Poll for 'transition' → 'default' completion
    checkDefaultModeReady();

    // Animation loop always runs — mode changes only affect behavior, not scheduling
    requestAnimationFrame(animate);
}

// Ensure smooth initial load by waiting until the image request ends
logoImage.src = 'assets/tedl.png';
logoImage.onload = () => {
    init();
    
    // Bind hover capabilities to roadmap cards
    const cards = document.querySelectorAll('.timeline-target');
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            if (isMobile()) return;
            if (isOrbitMode) return;
            activeCard = card;
        });
        card.addEventListener('mouseleave', () => { 
            activeCard = null;
            orbitTarget = null; 
            isOrbitMode = false;
        });
    });

    // Loop runs forever — unconditionally
    animate();

    // ── Center-based scroll trigger for particle mode switching ──
    // Uses scroll position to detect when the speaker section is near the
    // center of the screen (60% enter / 40% exit hysteresis buffer).
    const speakersSection = document.getElementById('speakers');

    function checkSpeakerSectionPosition() {
        if (!speakersSection) return;
        if (isMobile()) {
            if (particleMode !== 'default') {
                setParticleMode('default');
            }
            activeText = '';
            particlesArray.forEach(p => {
                p.targetTextX = undefined;
                p.targetTextY = undefined;
                p.currentOpacity = 1;
            });
            window._awaitingDefaultMode = false;
            return;
        }
        const rect = speakersSection.getBoundingClientRect();
        const wh   = window.innerHeight;
        const cardContainer = speakersSection.querySelector('.sc-stage');
        const cardRect = cardContainer ? cardContainer.getBoundingClientRect() : rect;

        // ENTER condition: section straddles the middle band (40%–60%),
        //                  AND cards are scrolled enough to be really visible
        const isCentered = rect.top < wh * 0.6 && rect.bottom > wh * 0.4;
        const cardsVisible = cardRect.top < wh * 0.75;

        if (isCentered && cardsVisible) {
            if (particleMode !== 'speaker') {
                setParticleMode('speaker');
                if (window.onParticleModeEnterSpeaker) window.onParticleModeEnterSpeaker();
            }
        } else {
            if (particleMode === 'speaker') {
                setParticleMode('transition');
                activeText = '';
                particlesArray.forEach(p => {
                    p.targetTextX = undefined;
                    p.targetTextY = undefined;
                    p.currentOpacity = 1;
                });
                window._awaitingDefaultMode = true;
            }
        }
    }

    // Poll on scroll with passive listener for performance
    window.addEventListener('scroll', checkSpeakerSectionPosition, { passive: true });
    // Also run once on load in case page starts scrolled
    checkSpeakerSectionPosition();
};

// Called from animate() — once all particles fully returned to X, set mode to 'default'
function checkDefaultModeReady() {
    if (window._awaitingDefaultMode && particleMode === 'transition') {
        const allBack = particlesArray.every(p => p.morphLerp <= 0);
        if (allBack) {
            setParticleMode('default');
            window._awaitingDefaultMode = false;
        }
    }
}
