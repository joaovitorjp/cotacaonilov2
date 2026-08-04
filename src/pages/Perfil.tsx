import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PerfilPanel from '@/components/PerfilPanel';

const Perfil: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) {
      navigate('/');
    }
  }, [open, navigate]);

  return (
    <PerfilPanel 
      open={open} 
      onOpenChange={setOpen} 
    />
  );
};

export default Perfil;
