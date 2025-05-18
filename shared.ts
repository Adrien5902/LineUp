export interface ServerToClientEvents {
    videoState: (paused: boolean, timestamp: number, vocals: boolean, accountForPing: boolean) => void
    subtitles: (subtitles?: Captions) => void
    setEpisode: (name: string | null) => void;
    episodes: (episodes: string[]) => void
    unavailableRoom: (room: string) => void
    joinedRoom: (room: string) => void
    leftRoom: () => void
}

export interface ClientToServerEvents {
    joinRoom: (room: string) => void;
    createOrJoinRoom: (room?: string) => void;
    type: (s: string) => void;
    setEpisode: (name: string | null) => void;
    newSubtitles: (newSubtitles: Captions) => void;
    fetchSubtitles: () => void;
    fetchVideoState: () => void;
    togglePause: (force: boolean, timestamp: number, vocals: boolean) => void
    getEpisodes: () => void
    leaveRoom: () => void
}

export interface Character {
    name: string
    color?: string
}

export interface Captions {
    characters?: Character[]
    captions: Subtitle[]
}

export interface Subtitle {
    character?: string;
    start: number;
    end: number;
    text: string;
}

export interface SocketData {
    discordId: string
    audioBlobs: AudioBlob[]
}

export interface AudioBlob {
    blob: ArrayBuffer
    volumeMap: number[]
    timestamp: number
    duration: number
}

export interface GameState {
    episode: string | null
    subtitles?: Captions
    vocals: boolean
    videoStart: number
    paused: boolean
    pausedAt: number
}