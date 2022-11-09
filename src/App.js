import "./App.css";

import { useEffect, useRef, useState } from 'react'

import * as Tone from "tone";
import {
  playNote,
  playNoteOnKeyPress,
} from "./tone.fn.js";


window.addEventListener("keydown", playNoteOnKeyPress);

const modes = { normal: "Normal", selectValidNodes: "selectValidNodes", createMelody: "createMelody", guessMelody: "guessMelody" }
const fundemental_piano_notes = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
const flat_piano_notes = [...fundemental_piano_notes]
const sharp_piano_notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const all_piano_notes = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"]
const piano_notes_mapping = { "C": "C", "C#": "Db", "Db": "Db", "D": "D", "D#": "Eb", "Eb": "Eb", "E": "E", "F": "F", "F#": "Gb", "Gb": "Gb", "G": "G", "G#": "Ab", "Ab": "Ab", "A": "A", "A#": "Bb", "Bb": "Bb", "B": "B" }
const black_key_notes = ["Db", "Eb", "Gb", "Ab", "Bb"]
const initialMelody = ["C4", "F4", "G4", "C4"]
function App() {
  const [sequence, setSequence] = useState(null)
  const [synth, setSynth] = useState(null)
  window.synth = synth;
  const [melody, setMelody] = useState([...initialMelody])
  const [mode, setMode] = useState("Normal")
  const [validNotes, setValidNotes] = useState([...flat_piano_notes])
  const [hiddenMelody, setHiddenMelody] = useState(false);
  const [melodyLength, setMelodyLength] = useState(4);
  const noteButtonRefs = useRef({});
  const melodyNoteDivRefs = useRef({});
  window.noteRefs = noteButtonRefs;
  window.melodyRefs = melodyNoteDivRefs;

  Tone.Transport.bpm.value = 45;
  Tone.Transport.loop = false;

  useEffect(() => {
    const s = new Tone.Synth().toDestination();
    setSynth(s);
    const seq = new Tone.Sequence((time, note) => {
      s.triggerAttackRelease(note, 0.1, time);
    }, [...initialMelody.map((note, index) => { return { note: note, index: index } })]);
    seq.loop = false;
    setSequence(seq);
  }, [melody])


  // reset sequence when melody changes
  useEffect(() => {
    if (!synth) return;

    Tone.Transport.stop();
    if (sequence) sequence.stop();
    const seq = new Tone.Sequence((time, note) => {
      synth.triggerAttackRelease(note.note, "8n", time);
      console.log("note: %O", note);
      Tone.Draw.schedule(() => {

        const currentOctave = 4
        // const currentRef = noteButtonRefs.current[note.note.replace(`${currentOctave}`, "")]

        const currentRef = melodyNoteDivRefs.current[note.index]
        console.log("current ref: %O", currentRef)
        if (currentRef) currentRef.className = currentRef.className + " animation-trigger"

      }, time)




    }, [...melody.map((note, index) => { return { note: note, index: index } })]);
    seq.loop = false;
    setSequence(seq);
  }, [melody, synth])


  return (
    <div className="pianoPage">
      <div>{`mode: ${mode}`}</div>
      <div className="controls">
        <button className="start" onClick={() => {
          if (!sequence) return;
          Tone.Transport.stop();
          sequence.stop();
          Tone.start();
          Tone.Transport.start();
          sequence.start(0);
        }}>
          Play
        </button>

        <button className="stop" onClick={() => {
          Tone.Transport.stop();
          if (sequence) sequence.stop();
        }}>
          Stop
        </button>
      </div>

      <div className="controls">
        <button className="start" onClick={() => {
          const res = [];
          for (let i = 0; i < melodyLength;) {
            const random = Math.floor(Math.random() * validNotes.length);
            const currentOctave = 4;
            res.push(validNotes[random] + `${currentOctave}`);
            i++;
          }
          console.log("res = ", res);
          setMelody(res);

        }}>
          Create Random Melody
        </button>

        <button className="start" onClick={() => {}}>
          Manually Create Melody
        </button>

        <button className="start" onClick={() => { setMode(modes.selectValidNodes) }}>
          Select valid notes
        </button>
        <button className="start" onClick={() => { setMode(modes.normal) }}>
          normal mode
        </button>
        <button className="start" onClick={() => { setHiddenMelody(state => !state) }}>
          Toggle Melody
        </button>


      </div>
      <div><label>Select length of melody</label>
        <select onChange={({ target: { value } }) => setMelodyLength(value)}>

          < option selected={melodyLength === 0} value={0}>0</option>
          < option selected={melodyLength === 1} value={1}>1</option>
          < option selected={melodyLength === 2} value={2}>2</option>
          < option selected={melodyLength === 3} value={3}>3</option>
          < option selected={melodyLength === 4} value={4}>4</option>
          < option selected={melodyLength === 5} value={5}>5</option>
          < option selected={melodyLength === 6} value={6}>6</option>
          < option selected={melodyLength === 7} value={7}>7</option>

        </select></div>
      <div className="melody">
        {melody.map((note, index) => {
          return (
            <div className="melody-note"
              ref={(element) => { melodyNoteDivRefs.current[index] = element; }}
              onAnimationEnd={event => {
                console.log("animation end");
                const currentRef = melodyNoteDivRefs.current[index]
                console.log("currentRef = ", currentRef);
                if (currentRef) currentRef.className = currentRef.className.replace(" animation-trigger", "")
              }}
            >{hiddenMelody ? "O " : note}</div>
          )
        })}
      </div>
      <div className="piano">
        {flat_piano_notes.map((note) => {
          return (
            <button
              className={"key " + (black_key_notes.includes(piano_notes_mapping[note]) ? "black" : "white") + (validNotes.includes(note) ? " selected" : "")}
              onClick={() => {
                console.log("button being pressed: %O", note)
                if (mode === modes.normal) {
                  playNote(synth, note + "4");
                } else if (mode === modes.selectValidNodes) {
                  const index = validNotes.indexOf(note)
                  if (index === -1) {
                    setValidNotes((notes) => {
                      return [...notes, note]
                    })
                  } else {
                    setValidNotes((notes) => {
                      return notes.filter(item => item !== note)
                    })
                  }
                }
              }}
              ref={(element) => { noteButtonRefs.current[note] = element; }}
              onAnimationEnd={event => {
                const currentRef = noteButtonRefs.current[note]
                if (currentRef) currentRef.className = currentRef.className.replace(" animation-trigger", "")
              }}
            >{note}</button>)
        })}
      </div>
    </div>
  );
}

export default App;
