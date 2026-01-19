'use client';

import { motion, useAnimation } from 'framer-motion';
import { useEffect, useState } from 'react';

interface SpinningWheelProps {
    participants: string[];
    winner?: string | null;
    isSpinning: boolean;
    onSpinComplete: () => void;
}

export const SpinningWheel = ({ participants, winner, isSpinning, onSpinComplete }: SpinningWheelProps) => {
    const controls = useAnimation();
    const [rotation, setRotation] = useState(0);

    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB'];

    useEffect(() => {
        if (isSpinning) {
            // Spin for 5 seconds
            const randomRotation = 360 * 5 + Math.random() * 360;
            controls.start({
                rotate: randomRotation,
                transition: { duration: 5, ease: "circOut" }
            }).then(() => {
                setRotation(randomRotation % 360);
                onSpinComplete();
            });
        }
    }, [isSpinning, controls, onSpinComplete]);

    // Calculate rotation to land on winner if known?
    // The contract picks a winner randomly. We can't pre-determine the visual landing unless we know the winner BEFORE we start spinning relative to the wheel.
    // BUT, the current flow is: Spin -> Wait for TX -> Get Winner.
    // So usually we show a loading spinner.
    // To make it "fair" visually, we should probably receive the winner index, calculate the angle, and spin TO that angle.
    // However, since we get the winner from chain AFTER the transaction clears, we can:
    // 1. Start spinning indefinitely when TX starts.
    // 2. When TX confirms and valid winner is passed, spin X more rounds and land on winner.

    // Let's implement that:
    // - Infinite spin while `isSpinning` is true but winner is null.
    // - Once winner is set, animate to that slice.

    // For MVP "Crazy" feature, let's just do a simple spin animation for now as the contract integration is the hard part.
    // If the winner comes from props *after* spin, we might just snap or highlight.
    // Let's try to do the smooth landing if possible.

    // Actually, `isSpinning` usually matches `isPending` or `isConfirming`.
    // We can just rotate continuously and then stop?

    return (
        <div className="relative w-64 h-64 md:w-96 md:h-96 mx-auto my-8">
            <div className="absolute top-0 left-1/2 -ml-4 z-10 text-4xl mt-[-20px]">▼</div>
            <motion.div
                className="w-full h-full rounded-full border-4 border-gray-800 overflow-hidden relative"
                animate={controls}
                style={{ rotate: rotation }}
            >
                {participants.length === 0 && (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                        Waiting for players...
                    </div>
                )}
                {participants.map((p, i) => {
                    const sliceAngle = 360 / participants.length;
                    const rotate = sliceAngle * i;
                    const skew = 90 - sliceAngle; // Simplified slice logic... actually creating pie slices with strict CSS/Divs is tricky without SVG.

                    // Allow simple SVG approach for perfect slices
                    return null;
                })}

                {/* SVG Implementation for better slices */}
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {participants.map((p, i) => {
                        const sliceAngle = 360 / participants.length;
                        const startAngle = i * sliceAngle;
                        const endAngle = (i + 1) * sliceAngle;

                        // Convert polar to cartesian
                        const x1 = 50 + 50 * Math.cos(Math.PI * startAngle / 180);
                        const y1 = 50 + 50 * Math.sin(Math.PI * startAngle / 180);
                        const x2 = 50 + 50 * Math.cos(Math.PI * endAngle / 180);
                        const y2 = 50 + 50 * Math.sin(Math.PI * endAngle / 180);

                        const largeArcFlag = sliceAngle > 180 ? 1 : 0;

                        const pathData = [
                            `M 50 50`,
                            `L ${x1} ${y1}`,
                            `A 50 50 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                            `Z`
                        ].join(' ');

                        return (
                            <path
                                key={i}
                                d={pathData}
                                fill={colors[i % colors.length]}
                                stroke="white"
                                strokeWidth="0.5"
                            />
                        );
                    })}
                </svg>

                {/* Names are hard to place in SVG without calculation, maybe overlay? */}
            </motion.div>
        </div>
    );
}

export default SpinningWheel;
