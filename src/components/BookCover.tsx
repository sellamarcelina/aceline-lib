import { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface BookCoverProps {
  src: string;
  title: string;
  className?: string;
}

export function BookCover({ src, title, className = '' }: BookCoverProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F9EEF1] via-[#F3DFE5] to-[#EAD6DC] p-4 text-center text-[#6B1D2F] ${className}`}
        role="img"
        aria-label={`Sampul ${title}`}
      >
        <BookOpen className="h-7 w-7 opacity-70 mb-2" strokeWidth={1.5} />
        <span className="font-editorial text-xs font-medium leading-snug line-clamp-3">
          {title}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Sampul buku ${title}`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
