import './App.css';

import { useEffect, useRef, useState } from 'react';
import { useReward } from 'react-rewards';

import * as Tone from 'tone';
import { Note, Scale, Chord } from '@tonaljs/tonal';
import * as Tonal from '@tonaljs/tonal';

import { playNote } from './tone.fn.js';
import { useWebsocket } from './useWebsocket';
import { formatISO } from 'date-fns';

// window.Scale = Scale;
// window.Note = Note;
window.Tonal = Tonal;
const modes = {
    normal: 'Normal',
    selectValidNodes: 'selectValidNodes',
    createMelody: 'createMelody',
    guessMelody: 'guessMelody',
};
const all_piano_notes = Tonal.Range.chromatic(['C3', 'C8']);
const default_scale_spec = { key: 'C', octave: 4, type: 'major pentatonic' };
const default_scale = Scale.get(
    `${default_scale_spec.key}${default_scale_spec.octave} ${default_scale_spec.type}`
).notes;
const scaleTypes = Scale.names();
const allChromaticNotes = Scale.get('C chromatic').notes;
const initialMelody = [...default_scale];
function App() {
    const [sequence, setSequence] = useState(null);
    const [chord, setChord] = useState(null);
    const [synth, setSynth] = useState(null);
    window.synth = synth;
    const [mode, setMode] = useState('Normal');

    const [validNotes, setValidNotes] = useState([...default_scale]);
    const [currentScaleSpec, setCurrentScaleSpec] = useState({ ...default_scale_spec });

    const [melodyLength, setMelodyLength] = useState(4);
    const [currentOctave, setCurrentOctave] = useState(4);
    const [melody, setMelody] = useState([...initialMelody]);
    const [guessedMelody, setGuessedMelody] = useState([]);
    const [previouslyGuessedMelodies, setPreviouslyGuessedMelodies] = useState([]);
    console.log('previouslyGuessedMelodies = ', previouslyGuessedMelodies);
    const [practiceData, setPracticeData] = useState([]);
    const [hiddenMelody, setHiddenMelody] = useState(false);
    const { reward, isAnimating } = useReward('rewardId', 'confetti');

    const noteButtonRefs = useRef({});
    const melodyNoteDivRefs = useRef({});
    const melodyDivRef = useRef();
    const pianoRef = useRef();
    window.noteRefs = noteButtonRefs;
    window.melodyRefs = melodyNoteDivRefs;

    Tone.Transport.bpm.value = 45;
    Tone.Transport.loop = false;

    // example send:       websocketSend(JSON.stringify({ command: 'add-scheduled-event', data: emacsEvent }))
    const { connected, toggleShouldConnect, websocketSend, sentMessageHistory, receivedMessageHistory } = useWebsocket(
        'ws://127.0.0.1:44445',
        () => {
            console.log('Websocket connection formed!');
        },
        (message) => {
            console.log('Received message over websocket: %O', message);
        }
    );

    useEffect(() => {
        const s = new Tone.PolySynth(Tone.Synth, {
            oscillator: {
                partialCount: 4,
                partials: [0, 2, 3, 4, 1],
                phase: 0,
                type: 'triangle10',
                harmonicity: 1,
                modulationIndex: 4,
                modulationType: 'square',
                count: 3,
                spread: 20,
                width: 0.2,
                modulationFrequency: 0.4,
            },
        }).toDestination();
        setSynth(s);

        const scaleChords = Scale.scaleChords(currentScaleSpec.type);
        const tonicChord = Chord.getChord(
            scaleChords.includes('M') ? 'M' : 'm',
            `${currentScaleSpec.key}${currentScaleSpec.octave}`
        );
        setChord(tonicChord.notes);
        console.log('tonicChord = ', tonicChord);
        const seq = new Tone.Sequence(
            (time, note) => {
                s.triggerAttackRelease(note.note, 0.1, time);
            },
            [
                ...initialMelody.map((note, index) => {
                    return { note: note, index: index };
                }),
            ]
        );
        seq.loop = false;
        setSequence(seq);
    }, [melody, currentScaleSpec]);

    useEffect(() => {
        console.log('scale changed!');
    }, [currentScaleSpec]);

    // reset sequence when melody changes
    useEffect(() => {
        if (!synth) return;

        Tone.Transport.stop();
        if (sequence) sequence.stop();

        const scaleChords = Scale.scaleChords(currentScaleSpec.type);
        const tonicChord = Chord.getChord(
            scaleChords.includes('M') ? 'M' : 'm',
            `${currentScaleSpec.key}${currentScaleSpec.octave}`
        );

        setChord(tonicChord.notes);

        const seq = new Tone.Sequence(
            (time, note) => {
                synth.triggerAttackRelease(note.note, '8n', time);
                Tone.Draw.schedule(() => {
                    // const currentOctave = 3;
                    // const currentRef = noteButtonRefs.current[note.note.replace(`${currentOctave}`, "")]

                    if (!note.index) return;
                    const currentRef = melodyNoteDivRefs.current[note.index];
                    if (currentRef) currentRef.className = currentRef.className + ' animation-trigger';
                }, time);
            },
            [
                ...melody.map((note, index) => {
                    return { note: note, index: index };
                }),
            ]
        );
        seq.loop = false;
        setSequence(seq);
    }, [melody, synth]);

    function onKeyPressed(e) {
        console.log(e.key);
        if (mode === modes.guessMelody) {
            if (e.key === 'Backspace') {
                setGuessedMelody((gm) => {
                    return gm.slice(0, -1);
                });
            }
        }
    }
    function createRandomMelody() {
        setGuessedMelody([]);
        setPreviouslyGuessedMelodies([]);
        setHiddenMelody(true);
        setMode(modes.guessMelody);
        const res = [];
        for (let i = 0; i < melodyLength; ) {
            const random = Math.floor(Math.random() * validNotes.length);
            res.push(validNotes[random]);
            i++;
        }
        console.log('res = ', res);
        setMelody(res);
    }
    return (
        <div className="pianoPage" onKeyDown={onKeyPressed} tabIndex={0}>
            <div>{`mode: ${mode}`}</div>
            <div className="controls">
                <button
                    className="button"
                    onClick={() => {
                        synth.triggerAttackRelease(chord, 0.5);
                    }}
                >
                    chord
                </button>
                <button
                    className="button"
                    onClick={() => {
                        if (!sequence) return;
                        Tone.Transport.stop();
                        sequence.stop();
                        Tone.start();
                        Tone.Transport.start();
                        sequence.start(0);
                    }}
                >
                    Play
                </button>

                <button
                    className="button"
                    onClick={() => {
                        Tone.Transport.stop();
                        if (sequence) sequence.stop();
                    }}
                >
                    Stop
                </button>
            </div>

            <div className="controls">
                <button className="button" onClick={createRandomMelody}>
                    Create Random Melody
                </button>

                <button
                    className="button"
                    onClick={() => {
                        if (mode === modes.selectValidNodes) {
                            setMode(modes.normal);
                        } else {
                            setMode(modes.selectValidNodes);
                        }
                    }}
                >
                    {mode === modes.selectValidNodes ? 'End Select' : 'Select Notes'}
                </button>

                <button
                    className="button"
                    onClick={() => {
                        if (mode === modes.guessMelody) {
                            setMode(modes.normal);
                        } else {
                            setMode(modes.guessMelody);
                        }
                    }}
                >
                    {mode === modes.guessMelody ? 'End Guess' : 'Guess Melody'}
                </button>
                <button
                    className="button"
                    onClick={() => {
                        setHiddenMelody((state) => !state);
                    }}
                >
                    {hiddenMelody ? 'Show Melody' : 'Hide Melody'}
                </button>
            </div>
            <div>
                <label>Select length of melody</label>
                <select onChange={({ target: { value } }) => setMelodyLength(value)}>
                    {Array(20)
                        .fill()

                        .map((_, index) => {
                            return (
                                <option selected={melodyLength === index} value={index}>
                                    {index}
                                </option>
                            );
                        })}
                </select>
            </div>

            <div>
                <label>Select octave</label>
                <select
                    onChange={({ target: { value } }) =>
                        setCurrentScaleSpec((scaleSpec) => {
                            return { ...scaleSpec, octave: value };
                        })
                    }
                >
                    {Array(8)
                        .fill()
                        .map((_, index) => {
                            return (
                                <option selected={currentScaleSpec.octave === index} value={index}>
                                    {index}
                                </option>
                            );
                        })}
                </select>
            </div>

            <div>
                <label>Select key</label>
                <select
                    onChange={({ target: { value } }) =>
                        setCurrentScaleSpec((scaleSpec) => {
                            return { ...scaleSpec, key: value };
                        })
                    }
                >
                    {allChromaticNotes.map((key) => {
                        return (
                            <option selected={currentScaleSpec.octave === key} value={key}>
                                {key}
                            </option>
                        );
                    })}
                </select>
            </div>

            <div>
                <label>Select Scale Type</label>
                <select
                    onChange={({ target: { value } }) =>
                        setCurrentScaleSpec((scaleSpec) => {
                            return { ...scaleSpec, key: value };
                        })
                    }
                >
                    {scaleTypes.map((type) => {
                        return (
                            <option selected={currentScaleSpec.type === type} value={type}>
                                {type}
                            </option>
                        );
                    })}
                </select>
            </div>
            <div className="piano" ref={pianoRef}>
                {all_piano_notes.map((note) => {
                    const noteInfo = Note.get(note);
                    return (
                        <button
                            className={
                                `key ${noteInfo.pc}Key ` +
                                (noteInfo.alt ? 'black' : 'white') +
                                (validNotes.includes(note) ? ' selected' : '')
                            }
                            onClick={() => {
                                console.log('button being pressed: %O', note);

                                if (!(mode === modes.guessMelody)) playNote(synth, note);
                                if (mode === modes.selectValidNodes) {
                                    const index = validNotes.indexOf(note);
                                    if (index === -1) {
                                        setValidNotes((notes) => {
                                            return [...notes, note];
                                        });
                                    } else {
                                        setValidNotes((notes) => {
                                            return notes.filter((item) => item !== note);
                                        });
                                    }
                                } else if (mode === modes.guessMelody) {
                                    if (guessedMelody.length < melody.length) {
                                        const no = `${note}`;
                                        setGuessedMelody((gm) => {
                                            return [...gm, no];
                                        });
                                    }
                                }
                            }}
                            ref={(element) => {
                                noteButtonRefs.current[note] = element;
                            }}
                            onAnimationEnd={(event) => {
                                const currentRef = noteButtonRefs.current[note];
                                if (currentRef)
                                    currentRef.className = currentRef.className.replace(' animation-trigger', '');
                            }}
                        >
                            {note}
                        </button>
                    );
                })}
            </div>

            <div
                className="melody"
                id="rewardId"
                ref={melodyDivRef}
                onAnimationEnd={(event) => {
                    if (!melodyDivRef) return;
                    melodyDivRef.current.className = melodyDivRef.current.className.replace(' success-animation', '');
                }}
            >
                {melody.map((note, index) => {
                    return (
                        <div
                            className={
                                'melody-note' +
                                (mode === modes.guessMelody && index === guessedMelody.length ? ' current' : '')
                            }
                            ref={(element) => {
                                melodyNoteDivRefs.current[index] = element;
                            }}
                            onAnimationEnd={(event) => {
                                const currentRef = melodyNoteDivRefs.current[index];
                                if (currentRef)
                                    currentRef.className = currentRef.className.replace(' animation-trigger', '');
                            }}
                        >
                            {hiddenMelody || mode === modes.guessMelody
                                ? index + 1 <= guessedMelody.length
                                    ? guessedMelody[index]
                                    : 'O'
                                : note}
                        </div>
                    );
                })}
                {mode === modes.guessMelody && (
                    <button
                        className="button guess submit"
                        onClick={() => {
                            if (guessedMelody.length !== melody.length) return;

                            setPreviouslyGuessedMelodies((pgm) => {
                                return [...pgm, { guess: [...guessedMelody], time: formatISO(Date.now()) }];
                            });

                            if (melody.every((val, index) => val === guessedMelody[index])) {
                                console.log('You got it!');
                                setHiddenMelody(false);
                                setMode(modes.normal);

                                reward();
                            } else {
                                console.log('melody is incorrect: %O, %O', melody, guessedMelody);
                            }

                            setGuessedMelody([]);
                        }}
                    >
                        Submit
                    </button>
                )}
            </div>
            <div className="melodies">
                {previouslyGuessedMelodies.reverse().map(({ guess: pMelody }) => {
                    return (
                        <div className="melody">
                            {pMelody.map((note, index) => {
                                const note_correct = note === melody[index];
                                const note_in_melody = melody.includes(note);
                                return (
                                    <div
                                        className={
                                            'melody-note' +
                                            (note_correct
                                                ? ' correct'
                                                : note_in_melody
                                                ? ' partially-correct'
                                                : ' wrong')
                                        }
                                    >
                                        {note}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
            <div>
                <button className="button" onClick={toggleShouldConnect}>
                    {`ws: ${connected ? 'connected' : 'disconnected'}`}
                </button>
                {connected && (
                    <button
                        className="button"
                        onClick={() => {
                            websocketSend(
                                JSON.stringify({ command: 'save-practice-data', data: JSON.stringify(practiceData) })
                            );
                        }}
                    >
                        Send Data
                    </button>
                )}
            </div>
        </div>
    );
}

export default App;
