import Phaser from 'phaser';
import type { AudioAsset } from '../assets/AssetManifest';

/** Plays the loaded sound if present, otherwise its synthesized placeholder tone. */
export function playSound(scene: Phaser.Scene, asset: AudioAsset): void {
  const sound = scene.sound;
  if (sound.mute) return;
  if (scene.cache.audio.exists(asset.key)) {
    sound.play(asset.key);
    return;
  }

  const tone = asset.fallbackTone;
  if (!tone || !(sound instanceof Phaser.Sound.WebAudioSoundManager)) return;
  const ctx = sound.context;
  if (ctx.state !== 'running') return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = tone.wave;
  osc.frequency.setValueAtTime(tone.from, now);
  osc.frequency.exponentialRampToValueAtTime(tone.to, now + tone.duration);
  gain.gain.setValueAtTime((tone.volume ?? 0.1) * sound.volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + tone.duration + 0.02);
}
