import express from "express";
import https from "node:https";
import { Server, type Socket } from "socket.io";
import cors from "cors";
import { certPath, keyPath, PORT } from "../../config";
import fs from "node:fs";
import type { Captions, ClientToServerEvents, GameState, ServerToClientEvents, SocketData } from "../../shared";
import util from 'node:util';

const startDate = new Date(Date.now());
const log_file = fs.createWriteStream(`./logs/${startDate.toLocaleDateString("fr").replaceAll("/", "-")}-${startDate.toLocaleTimeString("fr").replaceAll(":", "-")}.log`, { flags: 'w' });
const log_stdout = process.stdout;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const print = (...d: [any?, ...any[]]) => {
    log_file.write(`${util.format(...d)}\n`);
}
console.log = (...d) => {
    print(...d)
    log_stdout.write(`${util.format(...d)}\n`);
};

const cert = fs.readFileSync(certPath);
const key = fs.readFileSync(keyPath);

const app = express();

const server = https.createServer({ cert, key }, app);
// biome-ignore lint/complexity/noBannedTypes: <explanation>
const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, Partial<SocketData>>(server, {
    cors: { origin: "*" },
    connectionStateRecovery: {
        // the backup duration of the sessions and the packets
        maxDisconnectionDuration: 2 * 60 * 1000,
        // whether to skip middlewares upon successful recovery
        skipMiddlewares: true,
    }
});

export type LineUpSocket = typeof io extends Server<infer C2S, infer S2C, infer E, infer D>
    ? Socket<C2S, S2C, E, D>
    : never;

app.use(cors());
app.use(express.static("../client/dist"));
app.use("/media", express.static("./media", {
    setHeaders: (res, path) => {
        if (path.endsWith(".mp4")) res.set("Content-Type", "video/mp4");
        if (path.endsWith(".wav")) res.set("Content-Type", "audio/wav");
    }
}));

const gameStates: Record<string, GameState> = {}

function updateGame(socket: Socket, handler: (gameId: string, game: GameState) => void) {
    for (const room of socket.rooms) {
        if (gameStates[room]) {
            handler(room, gameStates[room])
        }
    }
}

io.on("connection", (socket) => {
    console.log(socket.id, "connected");

    socket.on("getEpisodes", () => {
        socket.emit("episodes", fs.readdirSync("./media"))
    })

    socket.on("joinRoom", (room) => {
        const game = gameStates[room]
        if (game) {
            socket.join(room)
            if (game.episode) {
                socket.emit("setEpisode", game.episode)
                socket.emit("videoState", game.paused, Date.now() - game.videoStart, game.vocals, true)
            }
            socket.emit("joinedRoom", room)
        } else {
            socket.emit("unavailableRoom", room)
        }
    })

    socket.on("createOrJoinRoom", (room) => {
        const gameId = room ?? new Array(5).fill("").map(() => ("ABCDEFGHIJKLMNOPQRSTUVWXYZ")[Math.floor(Math.random() * 26)]).join("")
        let game = gameStates[gameId]
        if (game) {
            console.log(socket.id, "joined room", gameId);
            if (game.episode) {
                socket.emit("setEpisode", game.episode)
                socket.emit("videoState", game.paused, Date.now() - game.videoStart, game.vocals, true)
            }
        } else {
            console.log(socket.id, "created room", gameId);
            game = {
                episode: null,
                subtitles: undefined,
                vocals: false,
                paused: true,
                videoStart: Date.now(),
                pausedAt: 0
            }
            gameStates[gameId] = game
        }
        socket.join(gameId)
        socket.emit("joinedRoom", gameId)
    })

    socket.on("fetchVideoState", () => {
        updateGame(socket, (_, game) => {
            socket.emit("videoState", game.paused, game.paused ? game.pausedAt : (Date.now() - game.videoStart), game.vocals, true)
        })
    })

    socket.on("togglePause", (pause, timestamp, vocals) => {
        updateGame(socket, (gameId, game) => {
            game.vocals = vocals;
            game.paused = pause
            game.pausedAt = timestamp
            game.videoStart = Date.now() - timestamp
            socket.to(gameId).emit("videoState", pause, timestamp, vocals, pause)
        })
    })

    socket.on("fetchSubtitles", () => {
        updateGame(socket, (_, game) => {
            socket.emit("subtitles", game.subtitles)
        })
    })

    socket.on("newSubtitles", (newSubtitles) => {
        updateGame(socket, (gameId, game) => {
            if (game.episode) {
                const oldJson = JSON.stringify(game.subtitles)
                const newJson = JSON.stringify(newSubtitles);
                if (oldJson !== newJson) {
                    print(socket.id, "modified subtitles for", game.episode, "from", oldJson, "to", newJson);
                    game.subtitles = newSubtitles;
                    socket.to(gameId).emit("subtitles", newSubtitles)
                    fs.writeFileSync(`./media/${game.episode}/captions.json`, JSON.stringify(newSubtitles))
                }
            }
        })
    })

    socket.on("setEpisode", (name) => {
        updateGame(socket, (gameId, game) => {
            game.episode = name
            if (name) {
                game.subtitles = JSON.parse(fs.readFileSync(`./media/${name}/captions.json`).toString()) as Captions
            }
            socket.to(gameId).emit("setEpisode", name)
        })
    })

    socket.on("leaveRoom", () => {
        leaveRoom(socket)
    })

    socket.on("disconnect", (reason) => {
        if (reason !== "ping timeout") {
            leaveRoom(socket)
            console.log(socket.id, "disconnected");
        }
    });
});

function leaveRoom(socket: LineUpSocket) {
    updateGame(socket, async (gameId) => {
        console.log(socket.id, "left game", gameId);
        socket.leave(gameId)
        socket.emit("leftRoom")
        const sockets = await io.in(gameId).fetchSockets()
        console.log("remaining players :", sockets.length);
        if (sockets.length === 0) {
            delete gameStates[gameId]
            console.log("removed game");
        }
    })
}


server.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});