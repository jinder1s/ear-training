export function playNote(synth, note, time = '8n') {
    synth.triggerAttackRelease(note, time);
}
