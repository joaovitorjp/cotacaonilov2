import React from 'react';
import { User as UserIcon } from 'lucide-react';
import { useAvatar } from '@/hooks/useAvatar';

interface Props {
  onClick: () => void;
  className?: string;
}

/** Avatar do usuário no menu fixo do topo — sempre visível e sincronizado com o upload. */
const HeaderAvatarButton: React.FC<Props> = ({ onClick, className = '' }) => {
  const { avatarUrl } = useAvatar();

  return (
    <button
      type="button"
      onClick={onClick}
      title="Perfil"
      aria-label="Abrir perfil"
      className={`shrink-0 w-9 h-9 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center hover:ring-2 hover:ring-primary/30 transition-all ${className}`}
    >
      {avatarUrl ? (
        <img
          key={avatarUrl}
          src={avatarUrl}
          alt="Foto de perfil"
          className="w-full h-full object-cover"
        />
      ) : (
        <UserIcon className="w-4 h-4 text-slate-500" />
      )}
    </button>
  );
};

export default HeaderAvatarButton;
