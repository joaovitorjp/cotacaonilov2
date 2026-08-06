import React, { useEffect, useState } from 'react';
import { User as UserIcon } from 'lucide-react';

interface Props {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
}

const initialsOf = (name?: string | null, email?: string | null) => {
  const base = (name ?? '').trim() || (email ?? '').split('@')[0] || '';
  if (!base) return '';
  const parts = base.replace(/[._-]+/g, ' ').split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  return letters.toUpperCase();
};

/** Avatar com fallback: foto -> iniciais -> ícone genérico. */
const UserAvatar: React.FC<Props> = ({
  src,
  name,
  email,
  className = 'w-9 h-9',
  iconClassName = 'w-4 h-4',
  textClassName = 'text-xs',
}) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const initials = initialsOf(name, email);
  const showImg = !!src && !failed;

  return (
    <div
      className={`rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center ${className}`}
    >
      {showImg ? (
        <img
          key={src as string}
          src={src as string}
          alt="Foto de perfil"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : initials ? (
        <span className={`font-bold text-slate-600 select-none ${textClassName}`}>{initials}</span>
      ) : (
        <UserIcon className={`text-slate-500 ${iconClassName}`} />
      )}
    </div>
  );
};

export default UserAvatar;
