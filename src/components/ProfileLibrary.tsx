import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { UserAlbum, UserProfile } from '../types';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Image as ImageIcon, X, Plus, Trash2, Lock, Zap, ChevronLeft, Loader2, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfileLibraryProps {
  uid: string;
  currentUserId: string | undefined;
  profile: UserProfile;
}

export function ProfileLibrary({ uid, currentUserId, profile }: ProfileLibraryProps) {
  const [albums, setAlbums] = useState<UserAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<UserAlbum | null>(null);
  
  // Create State
  const [newAlbumName, setNewAlbumName] = useState('');
  const [creating, setCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const isOwner = currentUserId === uid;
  const isPremium = profile.isPremium === true;

  const fetchAlbums = async () => {
    setLoading(true);
    try {
      const albumsQuery = query(
        collection(db, 'user_albums'), 
        where('uid', '==', uid), 
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(albumsQuery);
      setAlbums(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserAlbum)));
    } catch (error) {
      console.error("Error fetching albums", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlbums();
  }, [uid]);

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) return;
    try {
      // Pick multiple images
      const images = await Camera.pickImages({
        quality: 90,
        height: 1280,   // HD
        limit: 10,
      });

      if (!images.photos || images.photos.length === 0) return;
      if (images.photos.length > 10) {
        alert("Máximo de 10 fotos por álbum.");
        return;
      }

      setCreating(true);
      const albumId = doc(collection(db, 'user_albums')).id;
      const uploadedUrls: string[] = [];

      // Process and upload
      for (let i = 0; i < images.photos.length; i++) {
        const photo = images.photos[i];
        // @ts-ignore
        if (!photo.dataUrl && !photo.webPath && !photo.base64String) continue;
        
        // @ts-ignore
        let dataToUpload = photo.dataUrl || (photo.base64String ? `data:image/jpeg;base64,${photo.base64String}` : '');
        
        if (!dataToUpload) {
            // Some platforms return only webPath, we must fetch it to blob and convert to base64
            const response = await fetch(photo.webPath!);
            const blob = await response.blob();
            dataToUpload = await new Promise((resolve) => {
               const reader = new FileReader();
               reader.onloadend = () => resolve(reader.result as string);
               reader.readAsDataURL(blob);
            });
        }
        
        if (!dataToUpload) continue;

        setUploadProgress(Math.round(((i) / images.photos.length) * 100));
        
        const fileRef = ref(storage, `albums/${uid}/${albumId}/photo_${Date.now()}_${i}.jpg`);
        await uploadString(fileRef, dataToUpload, 'data_url');
        const url = await getDownloadURL(fileRef);
        uploadedUrls.push(url);
      }

      if (uploadedUrls.length === 0) {
        throw new Error("Erro ao processar as fotos.");
      }

      const newAlbum: UserAlbum = {
        id: albumId,
        uid: uid,
        name: newAlbumName.trim(),
        coverPhotoURL: uploadedUrls[0],
        photos: uploadedUrls,
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'user_albums', albumId), newAlbum);
      setAlbums([newAlbum, ...albums]);
      
      // Reset
      setShowCreateModal(false);
      setNewAlbumName('');
      setUploadProgress(0);
    } catch (e) {
      console.error(e);
      alert("Erro ao criar o álbum. Tente novamente.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    if (!confirm('Deseja excluir este álbum inteiro?')) return;
    try {
      await deleteDoc(doc(db, 'user_albums', albumId));
      setAlbums(albums.filter(a => a.id !== albumId));
      setSelectedAlbum(null);
      // P.S: Ideally we'd delete the storage folder here via a Firebase function or iterating,
      // but for client-side V1, removing the document hides it immediately.
    } catch (e) {
      alert("Erro ao excluir.");
    }
  };

  // View: Non-premium guest look
  if (!isPremium && albums.length === 0 && !isOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
        <ImageIcon className="w-12 h-12 text-zinc-600 mb-2" />
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nenhum álbum registrado</p>
      </div>
    );
  }

  // View: Owner is not premium 
  if (isOwner && !isPremium) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-zinc-900 border border-white/5 p-8 text-center flex flex-col items-center">
        <div className="absolute inset-0 bg-gradient-to-tr from-brand-primary/10 to-transparent" />
        <div className="w-16 h-16 bg-gradient-to-tr from-brand-primary to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-brand-primary/20 relative z-10">
           <Zap className="w-8 h-8 text-white fill-current" />
        </div>
        <h3 className="mt-4 text-white font-black italic uppercase text-lg relative z-10">Biblioteca Automotiva</h3>
        <p className="text-zinc-400 text-xs mt-2 max-w-[200px] relative z-10">
          Publique álbuns com até 10 fotos no seu perfil em estilo carrossel. Exclusivo para Pilotos Premium.
        </p>
        <button className="mt-6 bg-brand-primary text-white rounded-xl px-6 py-2.5 font-black uppercase tracking-widest text-[10px] relative z-10">
          Torne-se Elite
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {isOwner && isPremium && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[10px] font-black tracking-widest uppercase">Novo Álbum</span>
          </button>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-zinc-600" /></div>
        ) : (
          <div className="grid grid-cols-3 gap-2 pb-8">
            {albums.map(album => (
              <button 
                key={album.id}
                onClick={() => setSelectedAlbum(album)}
                className="aspect-square relative group bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden active:scale-[0.98] transition-all"
              >
                {album.coverPhotoURL && (
                  <img src={album.coverPhotoURL} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={album.name} referrerPolicy="no-referrer" />
                )}
                
                {/* Album Info Overlay - Mirrored from Garage style but smaller */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 pt-4">
                   <p className="text-[8px] font-black italic text-white uppercase tracking-tight truncate leading-none mb-0.5">{album.name}</p>
                   {album.photos.length > 1 && (
                     <p className="text-[6px] font-black text-brand-primary uppercase tracking-widest">{album.photos.length} FOTOS</p>
                   )}
                </div>

                {/* Badge Overlay for count */}
                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                   <div className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10 text-[6px] font-black text-white uppercase tracking-tighter">
                      ALBUM
                   </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-zinc-900 w-full sm:max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl relative"
            >
              <button onClick={() => setShowCreateModal(false)} className="absolute top-4 right-4 p-2 text-zinc-400">
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-white font-black italic uppercase text-lg mb-6">Criar Novo Álbum</h2>
              
              {creating ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="w-16 h-16 relative">
                    <div className="absolute inset-0 rounded-full border-4 border-zinc-800" />
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="8" className="text-brand-primary"
                        strokeDasharray="289" strokeDashoffset={289 - (289 * uploadProgress) / 100} style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
                    </svg>
                  </div>
                  <p className="text-white font-bold mt-4 animate-pulse">Enviando {uploadProgress}%...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest pl-1">Nome do Álbum</label>
                    <input 
                      type="text" 
                      maxLength={20}
                      value={newAlbumName}
                      onChange={e => setNewAlbumName(e.target.value)}
                      placeholder="Ex: Trackday Interlagos"
                      className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-primary transition-colors font-bold mt-1"
                    />
                  </div>
                  
                  <button 
                    onClick={handleCreateAlbum}
                    disabled={!newAlbumName.trim()}
                    className="w-full bg-brand-primary text-white font-black uppercase italic tracking-widest text-xs py-4 rounded-xl disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Selecionar Fotos (Máx 10)
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ALBUM CAROUSEL VIEWER */}
      <AnimatePresence>
        {selectedAlbum && (
           <AlbumViewerModal 
             album={selectedAlbum} 
             isOwner={isOwner} 
             onClose={() => setSelectedAlbum(null)}
             onDelete={() => handleDeleteAlbum(selectedAlbum.id)}
           />
        )}
      </AnimatePresence>
    </>
  );
}

function AlbumViewerModal({ album, isOwner, onClose, onDelete }: { album: UserAlbum, isOwner: boolean, onClose: () => void, onDelete: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
    >
      <div className="flex items-center justify-between p-4 absolute top-0 inset-x-0 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onClose} className="p-2 text-white">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h3 className="text-white font-black italic uppercase tracking-wider">{album.name}</h3>
        <div className="w-10">
           {isOwner && (
             <button onClick={onDelete} className="p-2 text-red-500">
               <Trash2 className="w-5 h-5" />
             </button>
           )}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto snap-x snap-mandatory flex items-center hide-scrollbar"
           onScroll={e => {
             const idx = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth);
             setCurrentIndex(idx);
           }}>
        {album.photos.map((url, i) => (
          <div key={i} className="min-w-full w-full h-[85vh] snap-center flex items-center justify-center shrink-0">
             <img src={url} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          </div>
        ))}
      </div>

      {album.photos.length > 1 && (
        <div className="absolute bottom-10 inset-x-0 flex justify-center gap-1.5 z-10">
          {album.photos.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/30'}`} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
