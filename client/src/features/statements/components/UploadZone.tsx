import React, { useState, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
    onFilesSelected: (files: File[]) => void;
    className?: string;
    children?: React.ReactNode;
}

export function UploadZone({ onFilesSelected, className, children }: UploadZoneProps) {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Only set dragging to false if we're leaving the drop zone itself
        // preventing flicker when dragging over children
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            onFilesSelected(files);
        }
    }, [onFilesSelected]);

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
                "relative transition-all duration-300",
                className
            )}
        >
            {/* Drag Overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 m-2 rounded-[2rem] border-2 border-dashed border-[#FFCC00]/40 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
                    <div className="flex flex-col items-center gap-4 p-8 pointer-events-none">
                        <div className="w-24 h-24 bg-[#FFCC00] rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(255,204,0,0.3)] animate-bounce">
                            <Upload className="h-12 w-12 text-[#0a0a0f]" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-lg font-black uppercase tracking-[0.2em] text-[#FFCC00]">Release to Upload</p>
                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">PDF or CSV Statements</p>
                        </div>
                    </div>
                </div>
            )}

            {children}
        </div>
    );
}
