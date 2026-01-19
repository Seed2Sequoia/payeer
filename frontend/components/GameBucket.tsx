'use client';
import { useState, useEffect, useRef } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { PAYEER_ADDRESS, PAYEER_ABI } from '../constants';
import { formatEther } from 'viem';
import SpinningWheel from './SpinningWheel';
import { Confetti } from './Confetti';

export function GameBucket({ sessionId }: { sessionId: bigint }) {
    const [tauntMsg, setTauntMsg] = useState('');
    const [isSpinning, setIsSpinning] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    // Sounds using Audio API
    const playWinSound = () => {
        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance("We have a winner!");
        utterance.rate = 1.2;
        synth.speak(utterance);
    };

    const playSpinSound = () => {
        // Simple oscillator beep for spin start if no files
    };

    const { data: sessionData, refetch } = useReadContract({
        address: PAYEER_ADDRESS,
        abi: PAYEER_ABI,
        functionName: 'getSession',
        args: [sessionId],
    });

    const { data: participants, refetch: refetchParticipants } = useReadContract({
        address: PAYEER_ADDRESS,
        abi: PAYEER_ABI,
        functionName: 'getParticipants',
        args: [sessionId],
    });

    const { data: taunts, refetch: refetchTaunts } = useReadContract({
        address: PAYEER_ADDRESS,
        abi: PAYEER_ABI,
        functionName: 'getTaunts',
        args: [sessionId],
    });

    const { writeContract, data: hash, isPending } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    const prevActiveRef = useRef<boolean | undefined>(undefined);

    useEffect(() => {
        if (isSuccess) {
            refetch();
            refetchParticipants();
            refetchTaunts();
            if (isSpinning) {
                // Transaction confirmed, but we'll let the wheel finish its 5s spin or stop it now?
                // The SpinningWheel component handles its own 5s timer.
                // We just need to make sure we show the winner when it's done.
            }
        }
    }, [isSuccess]);

    if (!sessionData) return <div>Loading Session...</div>;

    const [entryFee, isActive, winner, totalPool, participantCount] = sessionData;

    // Detect Winner Reveal
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        if (prevActiveRef.current === true && isActive === false && winner !== '0x0000000000000000000000000000000000000000') {
            setShowConfetti(true);
            playWinSound();
            const synth = window.speechSynthesis;
            const utterance = new SpeechSynthesisUtterance(`The winner is ${winner.slice(0, 6)}`);
            synth.speak(utterance);
        }
        prevActiveRef.current = isActive;
    }, [isActive, winner]);


    const handleJoin = () => {
        if (!tauntMsg) {
            alert("You must taunt to join!");
            return;
        }
        writeContract({
            address: PAYEER_ADDRESS,
            abi: PAYEER_ABI,
            functionName: 'joinSession',
            args: [sessionId, tauntMsg],
            value: entryFee,
        });
    };

    const handleSpin = () => {
        setIsSpinning(true);
        writeContract({
            address: PAYEER_ADDRESS,
            abi: PAYEER_ABI,
            functionName: 'spinWheel',
            args: [sessionId],
        });
    };

    const handleSpinComplete = () => {
        setIsSpinning(false);
        // If the winner is already here (refetched), good.
    };

    return (
        <div className="flex flex-col items-center gap-8 w-full max-w-4xl relative">
            {showConfetti && <Confetti />}

            <div className="w-full flex justify-center mb-8">
                <SpinningWheel
                    participants={Array.from({ length: Number(participantCount) }).map((_, i) => participants?.[i] || `Player ${i + 1}`)}
                    isSpinning={isSpinning || isPending || isConfirming}
                    onSpinComplete={handleSpinComplete}
                    winner={winner}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                {/* Stats Card */}
                <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                    <h3 className="text-xl font-semibold mb-4 text-muted-foreground">Session Stats</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span>Entry Fee:</span>
                            <span className="font-mono">{formatEther(entryFee)} ETH</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Pool:</span>
                            <span className="font-mono text-green-500">{formatEther(totalPool)} ETH</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Status:</span>
                            <span className={isActive ? "text-blue-500" : "text-red-500"}>
                                {isActive ? "Active" : "Closed"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Actions Card */}
                <div className="bg-card p-6 rounded-xl border border-border shadow-sm flex flex-col justify-center gap-4">
                    {isActive ? (
                        <>
                            <div className="flex flex-col gap-2">
                                <input
                                    type="text"
                                    placeholder="Enter your taunt (e.g. 'Ez money')"
                                    className="p-3 bg-background border border-gray-700 rounded text-foreground"
                                    value={tauntMsg}
                                    onChange={(e) => setTauntMsg(e.target.value)}
                                />
                                <button
                                    onClick={handleJoin}
                                    disabled={isPending || isConfirming}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg transition-colors"
                                >
                                    Join Game ({formatEther(entryFee)} ETH)
                                </button>
                            </div>

                            {Number(participantCount) > 0 && (
                                <button
                                    onClick={handleSpin}
                                    disabled={isPending || isConfirming || isSpinning}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-lg transition-colors mt-2 uppercase tracking-wider"
                                >
                                    {isSpinning ? "SPINNING..." : "SPIN THE WHEEL"}
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="text-center animate-bounce">
                            <h3 className="text-2xl font-bold text-yellow-500 mb-2">🏆 WINNER 🏆</h3>
                            <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20 break-all font-mono text-xl">
                                {winner}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Participants List */}
            <div className="w-full bg-card p-6 rounded-xl border border-border">
                <h3 className="text-xl font-bold mb-4">Participants ({Number(participantCount)})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {participants?.map((p, i) => (
                        <div key={i} className="p-4 bg-background rounded border border-border flex flex-col gap-1">
                            <div className="font-mono text-xs opacity-50 truncate">{p}</div>
                            {taunts && taunts[i] && (
                                <div className="text-lg font-bold text-pink-500">"{taunts[i]}"</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Add global type for speech synthesis if needed, though usually available in window
