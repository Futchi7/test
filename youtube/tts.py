"""VOICEVOXで文章を音声（WAV）にする。

使い方:
  python3 youtube/tts.py "読み上げる文" out.wav [--voice kurono|himari] [--speed 1.1]

チャンネル名などの英語はカタカナで書く（例: レゲエルーツグリーン）。
動画の概要欄に「VOICEVOX:玄野武宏」などのクレジットを必ず書く。
"""
import argparse
import os

from voicevox_core.blocking import Onnxruntime, OpenJtalk, Synthesizer, VoiceModelFile

VOICES = {"kurono": ("4.vvm", 11), "himari": ("1.vvm", 14)}
BASE = os.environ.get("VOICEVOX_DIR", os.path.expanduser("~/.voicevox"))

_synth = {}


def synthesizer(voice):
    if voice not in _synth:
        vvm, _ = VOICES[voice]
        ort = Onnxruntime.load_once(
            filename=f"{BASE}/onnxruntime/voicevox_onnxruntime-linux-x64-1.17.3/lib/libvoicevox_onnxruntime.so.1.17.3")
        syn = Synthesizer(ort, OpenJtalk(f"{BASE}/dict/open_jtalk_dic_utf_8-1.11"))
        with VoiceModelFile.open(f"{BASE}/vvms/{vvm}") as m:
            syn.load_voice_model(m)
        _synth[voice] = syn
    return _synth[voice]


def speak(text, out, voice="kurono", speed=1.1):
    syn = synthesizer(voice)
    style = VOICES[voice][1]
    q = syn.create_audio_query(text, style)
    q.speed_scale = speed
    with open(out, "wb") as f:
        f.write(syn.synthesis(q, style))
    return out


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("text")
    p.add_argument("out")
    p.add_argument("--voice", default="kurono", choices=VOICES)
    p.add_argument("--speed", type=float, default=1.1)
    a = p.parse_args()
    print(speak(a.text, a.out, a.voice, a.speed))
