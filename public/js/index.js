import { WEBGL, Scale, Display, Game } from 'phaser3';

const clientEvents = {
    outgoing: {
        TOGGLE_DEBUG_MODE: 'csToggleDebugMode'
    },
    incoming: {
        PLATFORM_INFO: 'scPlatformInfo',
        COLLIDER_INFO: 'scColliderInfo',
        CLEAR_COLLIDER_INFO: 'scClearColliderInfo',
        STAR_POSITION: 'scStarPosition'
    }
};

function makeMessage(action, data) {
    const resp = {
        action: action,
        data: data
    };

    return JSON.stringify(resp);
}

let platformInfo = [], colliderInfo = [];
let starPosition = { x: -100, y: -100 };

let host;
if (window.location.host === 'localhost:3000') {
    host = 'ws://localhost:3000';
} else {
    host = 'wss://box2dwasm-physics-on-the-server-side-with-phaser3-js.glitch.me';
}
const ws = new WebSocket(host);

const config = {
    type: WEBGL,

    canvas: document.getElementById('renderCanvas'),
    width: 800,
    height: 600,
    scaleMode: Scale.ScaleModes.FIT,
    autoCenter: Scale.Center.CENTER_BOTH,

    autoFocus: true,
    scene: { preload, create, update },
    backgroundColor: '#555',

    callbacks: {
        preBoot: (game) => {
            game.scale.on('resize', onResize, game);
        }
    }
};

function onResize() {
    const { right, top } = this.scale.canvasBounds;

    debugInfoPanel.style.top = `${top + 10}px`;
    debugInfoPanel.style.left = `${right - debugInfoPanel.clientWidth - 20}px`;
    debugInfoPanel.style.display = 'block';
}

const debugInfoCheckBox = document.getElementById('debugInfoCheckBox');
let showDebugInfo = debugInfoCheckBox.checked;
let clearColliderInfo = showDebugInfo;
debugInfoCheckBox.onchange = () => {
    showDebugInfo = debugInfoCheckBox.checked;
    ws.send(makeMessage(clientEvents.outgoing.TOGGLE_DEBUG_MODE,
        JSON.stringify({ debugMode: showDebugInfo })));
};

const debugInfoPanel = document.getElementById('debugInfoPanel');

function preload() {
    this.load.image('sky', 'assets/sky.png');
    this.load.image('ground', 'assets/platform.png');
    this.load.image('star', 'assets/star.png');
    this.load.image('bomb', 'assets/bomb.png');
    this.load.spritesheet('dude', 'assets/dude.png', {
        frameWidth: 32,
        frameHeight: 48
    });
}

function create() {
    this.add.image(400, 300, 'sky');
    this.star = this.add.image(starPosition.x, starPosition.y, 'star');

    // Platforms
    for (let i = 0; i < platformInfo.length; i++) {
        const x = platformInfo[i].x;
        const y = platformInfo[i].y;
        const scale = platformInfo[i].scale;
        this.add.image(x, y, 'ground').setScale(scale);
    }

    this.graphics = this.add.graphics();
}

function update() {

    this.star.x = starPosition.x;
    this.star.y = starPosition.y;

    if (showDebugInfo) {
        for (let i = 0; i < colliderInfo.length; i++) {
            const color = colliderInfo[i].color;
            const c = new Display.Color().setGLTo(color.r, color.g, color.b);
            this.graphics.lineStyle(3, c.color, 1);
            if (colliderInfo[i].colliderType == 'rectangle') {
                const vertices = colliderInfo[i].vertices;
                this.graphics.beginPath();
                this.graphics.moveTo(vertices[0].x, vertices[0].y);
                this.graphics.lineTo(vertices[1].x, vertices[1].y);
                this.graphics.lineTo(vertices[2].x, vertices[2].y);
                this.graphics.lineTo(vertices[3].x, vertices[3].y);
                this.graphics.closePath();
                this.graphics.strokePath();
            } else if (colliderInfo[i].colliderType == 'circle') {
                let angle = 0;
                const angleStep = 20;
                const n = 360 / angleStep;
                const x0 = colliderInfo[i].position.x;
                const y0 = colliderInfo[i].position.y;
                const radius = colliderInfo[i].radius;

                this.graphics.beginPath();

                let x = radius * Math.cos(angle * Math.PI / 180);
                let y = radius * Math.sin(angle * Math.PI / 180);
                this.graphics.moveTo(x0 + x, y0 + y);
                angle += angleStep;

                for (let i = 0; i < n; i++) {
                    x = radius * Math.cos(angle * Math.PI / 180);
                    y = radius * Math.sin(angle * Math.PI / 180);
                    this.graphics.lineTo(x0 + x, y0 + y);
                    angle += angleStep;
                }
                this.graphics.closePath();
                this.graphics.strokePath();
            }
        }
    }

    setTimeout(() => {
        if (clearColliderInfo) {
            colliderInfo = [];
            this.graphics.clear();
            clearColliderInfo = false;
        }
    }, 0);
}

ws.onopen = () => {
    console.log('Connected to server');

    ws.send(makeMessage(clientEvents.outgoing.TOGGLE_DEBUG_MODE,
        JSON.stringify({ debugMode: showDebugInfo })));

    ws.onmessage = event => {
        const action = JSON.parse(event.data).action;
        const data = JSON.parse(event.data).data;
        switch (action) {
            case clientEvents.incoming.PLATFORM_INFO: {
                platformInfo = JSON.parse(data);
                new Game(config);
                break;
            }
            case clientEvents.incoming.COLLIDER_INFO: {
                colliderInfo.push(JSON.parse(data));
                break;
            }
            case clientEvents.incoming.CLEAR_COLLIDER_INFO: {
                clearColliderInfo = true;
                break;
            }
            case clientEvents.incoming.STAR_POSITION: {
                starPosition = JSON.parse(data);
                break;
            }
            default: {
                console.log('Uknown action');
            }
        }
    };
};
//# sourceMappingURL=index.js.map
