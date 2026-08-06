import React from 'react';
import { useAvatar } from '@/hooks/useAvatar';
import { useAuth } from '@/contexts/AuthContext';
import UserAvatar from '@/components/UserAvatar';

interface Props {
  onClick: () => void;
  className?: string;
}

/** Avatar do usuário no menu fixo do topo — sempre visível e sincronizado com o upload. */
const HeaderAvatarButton: React.FC<Props> = ({ onClick, className = '' }) => {
  const { avatarUrl } = useAvatar();
  const { user } = useAuth();

  return (
    <button
      type="button"
      onClick={onClick}
      title="Perfil"
      aria-label="Abrir perfil"
      className={`shrink-0 rounded-full hover:ring-2 hover:ring-primary/30 transition-all ${className}`}
    >
      <UserAvatar
        src={avatarUrl}
        name={(user?.user_metadata as any)?.nome}
        email={user?.email}
        className="w-9 h-9"
      />
    </button>
  );
};

export default HeaderAvatarButton;
