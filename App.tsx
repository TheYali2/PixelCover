import React, { useState } from 'react';
import { Search, Disc, Shuffle, Loader2, Zap, XCircle, ArrowRight, X, AlertTriangle, ChevronRight, User } from 'lucide-react';
import { searchArtists, getRandomArtistName, getRandomAlbumForArtist, SpotifyArtist } from './services/spotify';
import PixelReveal from './components/PixelReveal';

interface AlbumData {
    id: string;
    artistName: string;
    albumName: string;
    coverUrl: string;
    releaseDate: string;
    spotifyUrl: string;
    type: 'album' | 'single' | 'compilation';
}

type GameStatus = 'MENU' | 'PLAYING' | 'WON' | 'LOST';
type GameMode = 'SPECIFIC' | 'RANDOM';

const MAX_GUESSES = 5;
const STARTING_PIXELATION = 35;

const App: React.FC = () => {
    const [status, setStatus] = useState<GameStatus>('MENU');
    const [gameMode, setGameMode] = useState<GameMode>('SPECIFIC');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [searchInput, setSearchInput] = useState('');
    const [artistCandidates, setArtistCandidates] = useState<SpotifyArtist[]>([]);
    const [currentArtist, setCurrentArtist] = useState<SpotifyArtist | null>(null);

    const [showQuitConfirm, setShowQuitConfirm] = useState(false);

    const [targetAlbum, setTargetAlbum] = useState<AlbumData | null>(null);
    const [guessInput, setGuessInput] = useState('');
    const [guessesUsed, setGuessesUsed] = useState(0);
    const [pixelFactor, setPixelFactor] = useState(STARTING_PIXELATION);
    const [lastWrongGuess, setLastWrongGuess] = useState<string | null>(null);
    const [playedIds, setPlayedIds] = useState<string[]>([]);

    const [score, setScore] = useState(0);


    const normalizeString = (str: string) => {
        return str
            .toLowerCase()
            .split('(')[0]
            .split('-')[0]
            .replace(/[^\p{L}\p{N}]/gu, '');
    };

    const handleSearch = async () => {
        if (!searchInput.trim()) return;
        setLoading(true);
        setArtistCandidates([]);
        setError(null);
        try {
            const results = await searchArtists(searchInput);
            setArtistCandidates(results);
            if (results.length === 0) {
                setError('No artists found');
            }
        } catch (e) {
            setError('Error searching artists');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectArtist = async (artist: SpotifyArtist) => {
        setCurrentArtist(artist);
        setGameMode('SPECIFIC');
        setPlayedIds([]);
        await loadRound(artist, []);
    };

    const handleRandomStart = async () => {
        setLoading(true);
        try {
            const name = await getRandomArtistName();
            const candidates = await searchArtists(name);
            if (candidates.length > 0) {
                const artist = candidates[0];
                setCurrentArtist(artist);
                setGameMode('RANDOM');
                setPlayedIds([]);
                await loadRound(artist, []);
            } else {
                throw new Error("Artist data not found");
            }
        } catch (e) {
            setError('Failed to fetch random artist. Try again.');
            setLoading(false);
        }
    };

    const loadRound = async (artist: SpotifyArtist, currentPlayedIds: string[]) => {
        setLoading(true);
        setError(null);
        setArtistCandidates([]);

        try {
            let album = await getRandomAlbumForArtist(artist.id, currentPlayedIds);

            if (!album && currentPlayedIds.length > 0) {
                setPlayedIds([]);
                album = await getRandomAlbumForArtist(artist.id, []);
            }

            if (!album || !album.images[0]?.url) {
                throw new Error('No music found for this artist');
            }

            setTargetAlbum({
                id: album.id,
                artistName: artist.name,
                albumName: album.name,
                coverUrl: album.images[0].url,
                releaseDate: album.release_date,
                spotifyUrl: album.external_urls.spotify,
                type: album.album_type
            });

            setPlayedIds(prev => [...prev, album!.id]);

            setGuessesUsed(0);
            setPixelFactor(STARTING_PIXELATION);
            setGuessInput('');
            setLastWrongGuess(null);
            setStatus('PLAYING');

        } catch (err: any) {
            setError(err.message || 'Could not load round');
            setStatus('MENU');
        } finally {
            setLoading(false);
        }
    };

    const nextRound = () => {
        if (gameMode === 'RANDOM') {
            handleRandomStart();
        } else if (currentArtist) {
            loadRound(currentArtist, playedIds);
        } else {
            setStatus('MENU');
        }
    };

    const submitGuess = () => {
        if (!targetAlbum || !guessInput.trim()) return;

        const normalizedGuess = normalizeString(guessInput);
        const normalizedTarget = normalizeString(targetAlbum.albumName);

        if (normalizedGuess.length === 0 && normalizedTarget.length > 0) {
            return;
        }

        if (normalizedGuess === normalizedTarget) {
            handleWin();
        } else {
            handleWrongGuess();
        }
    };

    const handleWrongGuess = () => {
        const newUsed = guessesUsed + 1;
        setGuessesUsed(newUsed);
        setLastWrongGuess(guessInput);
        setGuessInput('');

        if (newUsed >= MAX_GUESSES) {
            setPixelFactor(1);
            setStatus('LOST');
        } else {
            const step = Math.floor(STARTING_PIXELATION / MAX_GUESSES);
            setPixelFactor(prev => Math.max(1, prev - step - 2));
        }
    };

    const handleWin = () => {
        setPixelFactor(1);
        setStatus('WON');

        const points = Math.max(100, 1000 - (guessesUsed * 200));
        setScore(s => s + points);
    };

    const handleQuitRequest = () => {
        setShowQuitConfirm(true);
    };

    const confirmQuit = () => {
        setShowQuitConfirm(false);
        setStatus('MENU');
        setSearchInput('');
        setArtistCandidates([]);
        setCurrentArtist(null);
        setPlayedIds([]);
    };

    return (
        <div className="min-h-screen bg-theme-bg text-white font-sans flex flex-col relative overflow-x-hidden">

            <nav className="w-full flex justify-between items-center px-6 py-4 absolute top-0 left-0 z-20 pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto cursor-pointer" onClick={() => status === 'MENU' && window.location.reload()}>
                    <Disc className="text-theme-pink animate-[spin_10s_linear_infinite]" size={24} />
                    <span className="font-black text-xl tracking-tighter">PIXEL<span className="text-theme-purple">COVER</span></span>
                </div>

                <div className="flex items-center gap-3 pointer-events-auto">
                    <div className="flex items-center gap-2 bg-zinc-900/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5 shadow-lg">
                        <Zap size={14} className="text-yellow-400 fill-yellow-400" />
                        <span className="font-bold font-mono text-sm">{score}</span>
                    </div>

                    {status !== 'MENU' && (
                        <button
                            onClick={handleQuitRequest}
                            className="w-10 h-10 flex items-center justify-center bg-zinc-900/60 backdrop-blur-md hover:bg-red-500/10 hover:border-red-500/50 border border-white/5 rounded-2xl transition-all text-zinc-400 hover:text-red-500"
                            title="Quit Game"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </nav>

            <main className="flex-grow flex flex-col items-center justify-center p-4 relative w-full max-w-xl mx-auto min-h-screen">

                {loading && (
                    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
                        <Loader2 className="w-10 h-10 text-theme-pink animate-spin mb-4" />
                        <span className="text-white/50 font-mono text-sm tracking-widest animate-pulse">Loading...</span>
                    </div>
                )}

                {showQuitConfirm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
                        <div className="bg-zinc-900 p-6 rounded-3xl border border-white/10 text-center max-w-xs w-full shadow-2xl">
                            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="text-red-500 w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Quit Game?</h3>
                            <p className="text-zinc-500 text-sm mb-6">Are you sure you want to quit?</p>
                            <div className="flex gap-2">
                                <button onClick={() => setShowQuitConfirm(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-bold text-sm transition-colors">Cancel</button>
                                <button onClick={confirmQuit} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-3 rounded-xl font-bold text-sm transition-colors">Quit</button>
                            </div>
                        </div>
                    </div>
                )}

                {status === 'MENU' && (
                    <div className="w-full flex flex-col gap-8 animate-fade-in text-center mt-12">
                        <div className="space-y-2">
                            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white leading-none">
                                GUESS THE <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-theme-pink to-theme-purple">MUSIC</span>
                            </h1>
                            <p className="text-zinc-500 text-base md:text-lg">
                                Uncover the pixelated cover.
                            </p>
                        </div>

                        <div className="flex flex-col gap-4 w-full max-w-sm mx-auto">
                            <div className="relative group w-full">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-theme-pink to-theme-purple rounded-2xl blur opacity-20 group-hover:opacity-60 transition duration-500"></div>
                                <div className="relative bg-zinc-950 rounded-2xl p-1 flex items-center border border-white/10">
                                    <Search className="text-zinc-600 ml-3" size={18} />
                                    <input
                                        type="text"
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        placeholder="Search Artist"
                                        className="bg-transparent flex-1 outline-none text-white placeholder-zinc-600 font-medium px-3 py-3"
                                    />
                                    <button
                                        onClick={handleSearch}
                                        disabled={!searchInput}
                                        className="bg-white text-black hover:bg-zinc-200 px-5 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Search
                                    </button>
                                </div>

                                {artistCandidates.length > 0 && (
                                    <div className="absolute top-full left-0 w-full mt-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-30 animate-fade-in text-left max-h-64 overflow-y-auto">
                                        {artistCandidates.map(artist => (
                                            <button
                                                key={artist.id}
                                                onClick={() => handleSelectArtist(artist)}
                                                className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                                            >
                                                {artist.images && artist.images.length > 0 ? (
                                                    <img src={artist.images[0].url} alt={artist.name} className="w-8 h-8 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                                                        <User size={14} className="text-zinc-500" />
                                                    </div>
                                                )}
                                                <span className="font-medium text-zinc-200 text-sm flex-1 truncate">{artist.name}</span>
                                                <ChevronRight size={14} className="text-zinc-600" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-center gap-4 text-zinc-800 text-[10px] font-bold tracking-widest uppercase">
                                <div className="h-px bg-zinc-900 flex-1"></div>
                                <span>OR</span>
                                <div className="h-px bg-zinc-900 flex-1"></div>
                            </div>

                            <button
                                onClick={handleRandomStart}
                                className="w-full bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-theme-purple/50 text-zinc-300 hover:text-white py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 group"
                            >
                                <Shuffle size={16} className="text-theme-purple group-hover:rotate-180 transition-transform duration-500" />
                                <span>Random Artist</span>
                            </button>
                        </div>

                        {error && (
                            <div className="mx-auto text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl flex items-center gap-2 animate-bounce-small">
                                <XCircle size={14} /> {error}
                            </div>
                        )}
                    </div>
                )}

                {status !== 'MENU' && targetAlbum && (
                    <div className="w-full flex flex-col items-center animate-fade-in w-full max-w-sm gap-6 mt-8">

                        <div className="text-center">
                            <h3 className="text-2xl font-black uppercase tracking-tight text-white">
                                {targetAlbum.artistName}
                            </h3>
                            <p className="text-theme-purple text-xs font-bold tracking-widest uppercase mt-1 opacity-80">
                                Guess the {targetAlbum.type}
                            </p>
                        </div>

                        <div className="relative w-full shadow-2xl">
                            <PixelReveal
                                imageUrl={targetAlbum.coverUrl}
                                pixelFactor={pixelFactor}
                                onImageLoad={() => { }}
                            />

                            {status === 'WON' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-theme-purple/20 backdrop-blur-sm animate-fade-in border-2 border-theme-purple z-10">
                                    <div className="bg-black/90 px-6 py-4 border border-theme-purple text-center transform -rotate-3 shadow-2xl rounded-xl">
                                        <h2 className="text-3xl font-black text-theme-purple italic tracking-tighter">CORRECT!</h2>
                                        <div className="flex items-center justify-center gap-2 mt-1 text-white font-mono text-sm">
                                            <Zap className="fill-yellow-400 text-yellow-400" size={14} />
                                            <span>+{Math.max(100, 1000 - (guessesUsed * 200))} PTS</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {status === 'LOST' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-red-900/30 backdrop-blur-sm animate-fade-in border-2 border-red-500 z-10">
                                    <div className="bg-black/90 px-6 py-4 border border-red-500 text-center shadow-2xl rounded-xl">
                                        <h2 className="text-3xl font-black text-red-500 uppercase tracking-tighter">GAME OVER</h2>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 justify-center w-full max-w-[200px]">
                            {[...Array(MAX_GUESSES)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < guessesUsed
                                        ? 'bg-zinc-800'
                                        : status === 'WON'
                                            ? 'bg-theme-purple shadow-[0_0_8px_#8b5cf6]'
                                            : 'bg-theme-pink shadow-[0_0_8px_#ec4899]'
                                        }`}
                                />
                            ))}
                        </div>

                        {status === 'PLAYING' && (
                            <div className="w-full space-y-3">
                                <div className="relative group">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-theme-pink to-theme-purple rounded-xl blur opacity-20 group-hover:opacity-60 transition duration-500"></div>
                                    <div className="relative bg-zinc-950 rounded-xl p-1 flex border border-white/10">
                                        <input
                                            type="text"
                                            value={guessInput}
                                            onChange={(e) => setGuessInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
                                            placeholder={`Type ${targetAlbum.type} name`}
                                            className="w-full bg-transparent outline-none text-white text-base px-4 py-3 font-medium placeholder:text-zinc-600"
                                            autoFocus
                                        />
                                        <button
                                            onClick={submitGuess}
                                            className="bg-white text-black hover:bg-zinc-200 px-5 rounded-lg font-bold uppercase text-xs tracking-wider transition-colors"
                                        >
                                            Guess
                                        </button>
                                    </div>
                                </div>

                                {lastWrongGuess && (
                                    <div className="text-red-400 text-xs text-center animate-bounce-small flex items-center justify-center gap-1.5 font-medium">
                                        <XCircle size={12} />
                                        <span>Incorrect</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {(status === 'WON' || status === 'LOST') && (
                            <div className="w-full bg-zinc-900/40 border border-white/10 rounded-2xl p-5 text-center animate-fade-in backdrop-blur-md">
                                <div className="mb-5">
                                    <h2 className="text-xl font-bold text-white mb-1 leading-tight">{targetAlbum.albumName}</h2>
                                    <p className="text-zinc-500 font-mono text-xs">{targetAlbum.releaseDate.split('-')[0]}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <a
                                        href={targetAlbum.spotifyUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="bg-[#1DB954]/10 text-[#1DB954] hover:bg-[#1DB954]/20 border border-[#1DB954]/20 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
                                    >
                                        <Disc size={16} /> Spotify
                                    </a>
                                    <button
                                        onClick={nextRound}
                                        className="bg-white text-black hover:bg-zinc-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
                                    >
                                        Next <ArrowRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            <div className="fixed bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black to-transparent pointer-events-none z-0"></div>
        </div>
    );
};

export default App;