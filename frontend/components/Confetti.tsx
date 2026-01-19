'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export const Confetti = () => {
    const [pieces, setPieces] = useState<{ id: number; x: number; color: string }[]>([]);

    useEffect(() => {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'];
        const newPieces = Array.from({ length: 50 }).map((_, i) => ({
            id: i,
            x: Math.random() * 100, // percent
            color: colors[Math.floor(Math.random() * colors.length)],
        }));
        setPieces(newPieces);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {pieces.map((p) => (
                <motion.div
                    key={p.id}
                    initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
                    animate={{ y: '100vh', opacity: 0, rotate: 360 * 2 }} // Fall down
                    transition={{
                        duration: 2 + Math.random() * 3, // Random duration
                        ease: "easeOut",
                        delay: Math.random() * 0.5
                    }}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '10px',
                        height: '10px',
                        backgroundColor: p.color,
                    }}
                />
            ))}
        </div>
    );
};
