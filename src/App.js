import './App.css';

import { useEffect, useRef, useState } from 'react';
import { useReward } from 'react-rewards';
import lodash from 'lodash';

import * as Tone from 'tone';
import { Note, Scale, Chord } from '@tonaljs/tonal';
import * as Tonal from '@tonaljs/tonal';

import { playNote } from './tone.fn.js';
import { useWebsocket } from './useWebsocket';
import { formatISO } from 'date-fns';

// window.Scale = Scale;
// window.Note = Note;
window.Tonal = Tonal;

window.lodash = lodash;
const modes = {
    normal: 'Normal',
    selectValidNodes: 'selectValidNodes',
    createMelody: 'createMelody',
    guessMelody: 'guessMelody',
};
const default_scale_spec = { key: 'D', octave: 3, type: 'major' };
const default_scale = Scale.get(
    `${default_scale_spec.key}${default_scale_spec.octave} ${default_scale_spec.type}`
).notes;
const all_piano_notes = Tonal.Range.chromatic(['C1', 'C8'], {
    sharps: default_scale.some((key) => {
        return key.includes('#');
    }),
});
const scaleTypes = ['major', 'minor'];
const scaleChordProgression = { major: [0, 3, 4, 0] };
const allChromaticNotes = Scale.get('D chromatic').notes;
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
    const [practiceData, setPracticeData] = useState([]);
    window.practiceData = practiceData;
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
            envelope: {
                attack: 0.008,
                attackCurve: 'linear',
                decay: 0.3,
                decayCurve: 'exponential',
                release: 0.5,
                releaseCurve: 'exponential',
                sustain: 0.1,
            },
            oscillator: {
                phase: 90,
                partials: new Array(8).fill(0).map(() => Math.random()),
                type: 'sawtooth2',
                harmonicity: 4,
                modulationIndex: 4,
                modulationType: 'sine2',
                count: 5,
                spread: 20,
                width: 0.5,
                modulationFrequency: 0.4,
            },
        }).toDestination();
        setSynth(s);

        const seq = new Tone.Sequence(
            (time, note) => {
                s.triggerAttackRelease(note.note, '8n', time);
            },
            [
                ...initialMelody.map((note, index) => {
                    return { note: note, index: index };
                }),
            ]
        );
        seq.loop = false;
        setSequence(seq);
        let currentKey = Tonal.Key.majorKey(currentScaleSpec.key);
        if (currentScaleSpec.type === 'minor') {
            const currentKey = Tonal.Key.minorKey(currentScaleSpec.key);
        }
        console.log('currentKey: %O', currentKey);

        const chordProgression = scaleChordProgression[currentScaleSpec.type].map((index) => {
            return {
                chord: Tonal.Chord.get(currentKey.chords[index])
                    .notes.slice(0, 3)
                    .map((note) => `${note}${currentScaleSpec.octave}`),
            };
        });
        console.log('chordProgression: %O', chordProgression);
        var chordPart = new Tone.Sequence(function (time, chord) {
            s.triggerAttackRelease(chord.chord, '8n', time);
        }, chordProgression);

        chordPart.loop = false;
        setChord(chordPart);
    }, []);
    useEffect(() => {
        addToPracticeData('switch-mode', { new_mode: mode });
    }, [mode]);

    useEffect(() => {
        addToPracticeData('switch-scale', { new_scale: currentScaleSpec });
    }, [currentScaleSpec]);
    useEffect(() => {
        addToPracticeData('new-melody', { melody: [...melody] });
    }, [melody]);

    useEffect(() => {
        addToPracticeData('switch-melody-length', { length: melodyLength });
    }, [melodyLength]);

    useEffect(() => {
        addToPracticeData('switch-valid-notes', { notes: [...validNotes] });
    }, [validNotes]);

    useEffect(() => {
        const scaleChords = Scale.scaleChords(currentScaleSpec.type);
        const tonicChord = Chord.getChord(
            scaleChords.includes('M') ? 'M' : 'm',
            `${currentScaleSpec.key}${currentScaleSpec.octave}`
        );

        // setChord(tonicChord.notes);
    }, [currentScaleSpec]);
    // reset sequence when melody changes
    useEffect(() => {
        if (!synth) return;

        Tone.Transport.stop();
        if (sequence) sequence.stop();

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
        if (e.key === 'Backspace') {
            setGuessedMelody((gm) => {
                return gm.slice(0, -1);
            });
            e.stopPropagation();
            e.preventDefault();
        } else if (e.code === 'Space') {
            playMelody();

            e.preventDefault();
            e.stopPropagation();
        } else if (e.code === 'KeyR') {
            playChord();

            e.preventDefault();
            e.stopPropagation();
        } else if (e.code === 'KeyN') {
            createRandomMelody();

            e.preventDefault();
            e.stopPropagation();
        }
    }
    function createRandomMelody() {
        setGuessedMelody([]);
        setPreviouslyGuessedMelodies([]);
        setHiddenMelody(true);
        const res = [];
        for (let i = 0; i < melodyLength; ) {
            const random = Math.floor(Math.random() * validNotes.length);
            res.push(validNotes[random]);
            i++;
        }
        setMelody(res);
        setMode(modes.guessMelody);
    }
    function playMelody() {
        if (!sequence) return;

        if (chord) chord.stop();
        Tone.Transport.stop();
        sequence.stop();
        Tone.start();
        Tone.Transport.start();
        sequence.start(0);
        addToPracticeData('play-melody');
    }

    function playChord() {
        if (!chord) return;
        if (sequence) sequence.stop();
        Tone.Transport.stop();
        chord.stop();
        Tone.start();
        Tone.Transport.start();
        chord.start(0);
        addToPracticeData('play-chord');
    }
    function addToPracticeData(type, data = null) {
        setPracticeData((pg) => {
            return [
                ...pg,
                {
                    type: type,
                    time: formatISO(Date.now()),
                    ...(data && { data: data }),
                },
            ];
        });
    }
    return (
        <div className="pianoPage" onKeyDown={onKeyPressed} tabIndex={0}>
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

            <div className="main controls">
                <button className="button play" onClick={playMelody}>
                    Play
                </button>

                <button
                    className="button stop"
                    onClick={() => {
                        Tone.Transport.stop();
                        if (sequence) sequence.stop();
                        addToPracticeData('stop-melody');
                    }}
                >
                    Stop
                </button>
                <button className="button chord" onClick={playChord}>
                    chord
                </button>

                <button className="button new" onClick={createRandomMelody}>
                    New Melody
                </button>
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
                        onClick={(e) => {
                            if (guessedMelody.length !== melody.length) return;
                            setPracticeData((pd) => {
                                return [
                                    ...pd,
                                    {
                                        type: 'guess',
                                        data: { melody: [...guessedMelody] },
                                        time: formatISO(Date.now()),
                                    },
                                ];
                            });

                            setPreviouslyGuessedMelodies((pgm) => {
                                return [...pgm, { guess: [...guessedMelody] }];
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
            <div className="advanced">
                <div className="controls">
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
                                <option selected={currentScaleSpec.key === key} value={key}>
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
                                return { ...scaleSpec, type: value };
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
                <div>
                    <button className="button" onClick={toggleShouldConnect}>
                        {`ws: ${connected ? 'connected' : 'disconnected'}`}
                    </button>
                    {connected && (
                        <button
                            className="button"
                            onClick={() => {
                                websocketSend(
                                    JSON.stringify({
                                        command: 'save-practice-data',
                                        data: JSON.stringify(lodash.uniqWith(practiceData, lodash.isEqual)),
                                    })
                                );
                                setPracticeData([]);
                            }}
                        >
                            Send Data
                        </button>
                    )}
                </div>
            </div>
            <div>
                {connected &&
                    practiceData.map((datum) => {
                        return <div>{JSON.stringify(datum)}</div>;
                    })}
            </div>
        </div>
    );
}

export default App;
