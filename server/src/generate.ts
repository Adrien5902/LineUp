import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Captions } from '../../shared';

const episode = process.argv[2];
const episodePath = path.join("./media/", episode)

function p(s: string) {
    return path.join(episodePath, s)
}

console.log("getting audio");
exec(`ffmpeg -y -i "${p("video.mp4")}" "${p("vocals.wav")}"`, (e) => {
    console.log(e);
    console.log("separating tracks");
    exec(`demucs "${p("vocals.wav")}" --two-stems vocals`, (e) => {
        fs.renameSync("./separated/htdemucs/vocals/no_vocals.wav", p("no_vocals.wav"))
        fs.rmSync("./separated", { force: true, recursive: true })
        console.log("generating subtitles");
        exec(`whisper --device cuda --output_format json --model turbo "${p("vocals.wav")}"`, (e) => {
            const data = JSON.parse(fs.readFileSync("./vocals.json").toString()) as {
                segments: { start: number, end: number, text: string }[]
            }

            fs.writeFileSync(p("captions.json"), JSON.stringify(
                {
                    captions: data.segments.map((st) => ({
                        start: st.start,
                        end: st.end,
                        text: st.text
                    })),
                    characters: []
                } as Captions))

            fs.rmSync("./vocals.json")
            console.log("done");
        })
    })
})