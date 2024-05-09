import express from 'express';
import http from 'http';
import shortId from 'shortid';
import { WebSocketServer } from 'ws';
import path from 'path';
import { box2d, initBox2D } from "./init-box2d.js";
import { serverEvents, makeMessage } from '../share/events.js';
import DebugDrawer from './debug-drawer.js';

const app = express();
const platformInfo = [];
let world;
const pixelsPerMeter = 50;
let debugMode = false;
const clients = {};
const clientsInDebugMode = {};
let starBody;

platformInfo[0] = { x: 400, y: 568, w: 400, h: 32, scale: 2 };
platformInfo[1] = { x: 600, y: 400, w: 400, h: 32, scale: 1 };
platformInfo[2] = { x: 50, y: 250, w: 400, h: 32, scale: 1 };
platformInfo[3] = { x: 750, y: 220, w: 400, h: 32, scale: 1 };

app.use(express.static(path.join(process.cwd(), 'public')));

const httpServer = http.createServer(app);
const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
    console.log(`Listening at port: ${port}`);
    init();
});

const webSocketServer = new WebSocketServer({ server: httpServer });

webSocketServer.on('connection', client => {
    const clientId = shortId.generate();
    console.log(`Client with id=${clientId} was connected`);
    clients[clientId] = client;

    client.send(makeMessage(serverEvents.outgoing.PLATFORM_INFO,
        JSON.stringify(platformInfo)));

    client.onmessage = event => {
        const action = JSON.parse(event.data).action;
        const data = JSON.parse(event.data).data;
        switch (action) {
            case serverEvents.incoming.TOGGLE_DEBUG_MODE: {
                debugMode = JSON.parse(data).debugMode;
                if (debugMode) {
                    clientsInDebugMode[clientId] = client;
                } else {
                    delete clientsInDebugMode[clientId];
                }
                break;
            }
        }
    };

    client.onclose = () => {
        console.log(`Client with id=${clientId} was disconnected`);
        delete clients[clientId];

        if (clientsInDebugMode[clientId]) {
            delete clientsInDebugMode[clientId];
        }
        if (Object.keys(clientsInDebugMode).length === 0) {
            debugMode = false;
        }
    };
});

async function init() {
    await initBox2D();

    const {
        b2_dynamicBody,
        b2_staticBody,
        b2BodyDef,
        b2CircleShape,
        b2PolygonShape,
        b2Vec2,
        b2World
    } = box2d;

    const gravity = new b2Vec2(0, 10);
    world = new b2World(gravity);

    // Platforms
    for (let i = 0; i < platformInfo.length; i++) {
        const shape = new b2PolygonShape();
        const halfWidth = platformInfo[i].w * platformInfo[i].scale / 2 / pixelsPerMeter;
        const halfHeight = platformInfo[i].h * platformInfo[i].scale / 2 / pixelsPerMeter;
        shape.SetAsBox(halfWidth, halfHeight);
        const bodyDef = new b2BodyDef();
        bodyDef.type = b2_staticBody;
        const x = platformInfo[i].x / pixelsPerMeter;
        const y = platformInfo[i].y / pixelsPerMeter;
        bodyDef.set_position(new b2Vec2(x, y));
        const body = world.CreateBody(bodyDef);
        const fixture = body.CreateFixture(shape, 0);
        fixture.SetFriction(3);
    }

    // Star
    const starShape = new b2CircleShape();
    starShape.m_radius = 10 / pixelsPerMeter;
    const starBodyDef = new b2BodyDef();
    starBodyDef.type = b2_dynamicBody;
    const starPosX = 300 / pixelsPerMeter;
    const starPosY = 100 / pixelsPerMeter;
    starBodyDef.set_position(new b2Vec2(starPosX, starPosY));
    starBody = world.CreateBody(starBodyDef);
    starBody.SetFixedRotation(true);
    const starFixture = starBody.CreateFixture(starShape, 1);
    starFixture.SetFriction(3);
    starFixture.SetRestitution(1);

    const debugDrawer = new DebugDrawer(pixelsPerMeter, clientsInDebugMode);
    world.SetDebugDraw(debugDrawer.instance);
    setInterval(() => physicsLoop(), 16);
}

function physicsLoop() {
    world.Step(0.016, 3, 2);

    for (const key in clients) {
        clients[key].send(makeMessage(serverEvents.outgoing.STAR_POSITION,
            JSON.stringify({
                x: starBody.GetPosition().x * pixelsPerMeter,
                y: starBody.GetPosition().y * pixelsPerMeter
            })));
    }

    if (debugMode) {
        world.DebugDraw();
        // Clear colliders
        for (const key in clientsInDebugMode) {
            clientsInDebugMode[key].send(makeMessage(serverEvents.outgoing.CLEAR_COLLIDER_INFO, null));
        }
    }
}
