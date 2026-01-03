import React, { useState, useEffect } from 'react';
import { Search, Disc, Shuffle, Loader2, Zap, XCircle, ArrowRight, X, AlertTriangle, ChevronRight, User, HelpCircle, SkipForward, Trophy, Timer, Clock, AlertCircle } from 'lucide-react';
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

type GameStatus = 'MENU' | 'PLAYING' | 'WON' | 'LOST' | 'ALL_CLEARED';
type GameMode = 'SPECIFIC' | 'RANDOM';
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
type HintLevel = 'NONE' | 'MASKED' | 'FIRST_WORD';

const MAX_GUESSES = 4;
const STARTING_PIXELATION = 35;
const TIMER_SETTINGS = {
    EASY: 30,
    MEDIUM: 10,
    HARD: 5
};

const App: React.FC = () => {
    const [status, setStatus] = useState<GameStatus>('MENU');
    const [gameMode, setGameMode] = useState<GameMode>('SPECIFIC');
    const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

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
    const [lossReason, setLossReason] = useState<'SKIP' | 'TIME_UP' | 'OUT_OF_GUESSES' | null>(null);

    const [hintLevel, setHintLevel] = useState<HintLevel>('NONE');

    const [enableTimer, setEnableTimer] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);

    const [score, setScore] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('pixelCoverXP');
            return saved ? parseInt(saved, 10) : 0;
        }
        return 0;
    });

    useEffect(() => {
        localStorage.setItem('pixelCoverXP', score.toString());
    }, [score]);

    useEffect(() => {
        if (status === 'PLAYING' && enableTimer && timeLeft > 0) {
            const interval = setInterval(() => {
                setTimeLeft((prev) => Math.max(0, prev - 1));
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [status, enableTimer, timeLeft]);

    useEffect(() => {
        if (status === 'PLAYING' && enableTimer && timeLeft === 0) {
            handleTimeUp();
        }
    }, [timeLeft, status, enableTimer]);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);


    const showToast = (msg: string) => {
        setToastMessage(msg);
    };

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
        await loadRound(artist, [], difficulty);
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
                await loadRound(artist, [], difficulty);
            } else {
                throw new Error("Artist data not found");
            }
        } catch (e) {
            setError('Failed to fetch random artist. Try again.');
            setLoading(false);
        }
    };

    const loadRound = async (artist: SpotifyArtist, currentPlayedIds: string[], diff: Difficulty) => {
        setLoading(true);
        setError(null);
        setArtistCandidates([]);
        setLossReason(null);

        try {
            let album = await getRandomAlbumForArtist(artist.id, diff, currentPlayedIds);

            if (!album) {
                if (gameMode === 'SPECIFIC') {
                    setStatus('ALL_CLEARED');
                    setLoading(false);
                    return;
                } else {
                    setPlayedIds([]);
                    album = await getRandomAlbumForArtist(artist.id, diff, []);
                }
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
            setHintLevel('NONE');

            if (enableTimer) {
                setTimeLeft(TIMER_SETTINGS[diff]);
            } else {
                setTimeLeft(0);
            }

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
            loadRound(currentArtist, playedIds, difficulty);
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

        if (enableTimer) {
            setTimeLeft(TIMER_SETTINGS[difficulty]);
        }

        if (newUsed >= MAX_GUESSES) {
            setPixelFactor(1);
            setLossReason('OUT_OF_GUESSES');
            setStatus('LOST');
            return;
        }

        const step = Math.floor(STARTING_PIXELATION / MAX_GUESSES);
        setPixelFactor(prev => Math.max(4, prev - step - 1));
    };

    const handleWin = () => {
        setPixelFactor(1);
        setStatus('WON');
        const difficultyMulti = difficulty === 'EASY' ? 1 : difficulty === 'MEDIUM' ? 1.5 : 2;
        let basePoints = Math.max(100, 1000 - (guessesUsed * 200));

        if (enableTimer && timeLeft > 0) {
            basePoints += (timeLeft * 10);
        }

        setScore(s => Math.floor(s + (basePoints * difficultyMulti)));
    };

    const handleSkip = () => {
        if (score < 50) {
            showToast("Not enough XP! Need 50 XP to skip.");
            return;
        }

        setPixelFactor(1);
        setLossReason('SKIP');
        setStatus('LOST');
        setScore(s => Math.max(0, s - 50));
    };

    const handleTimeUp = () => {
        setPixelFactor(1);
        setLossReason('TIME_UP');
        setStatus('LOST');
    };

    const handleHint = () => {
        if (score < 25) {
            showToast("Not enough XP! Need 25 XP for a hint.");
            return;
        }

        if (hintLevel === 'NONE') setHintLevel('MASKED');
        else if (hintLevel === 'MASKED') setHintLevel('FIRST_WORD');
        setScore(s => Math.max(0, s - 25));
    };

    const getExtraInfoHint = () => {
        if (!targetAlbum || hintLevel === 'NONE') return null;
        const name = targetAlbum.albumName;

        const featMatch = name.match(/\((feat\.|with|starring)(.*?)\)/i);
        const remixMatch = name.match(/-(.*?)remix/i) || name.match(/\((.*?)remix\)/i);

        if (featMatch) {
            return <span className="text-theme-purple font-bold text-xs">feat. {featMatch[2]}</span>;
        }
        if (remixMatch) {
            return <span className="text-theme-purple font-bold text-xs">Remix Version</span>;
        }

        return null;
    };

    const getHintText = () => {
        if (!targetAlbum) return '';
        const cleanTitle = targetAlbum.albumName.split('(')[0].split('-')[0].trim();

        if (hintLevel === 'MASKED') {
            return cleanTitle.replace(/[\p{L}\p{N}]/gu, '_ ');
        }

        if (hintLevel === 'FIRST_WORD') {
            const words = cleanTitle.split(' ');
            if (words.length > 1) {
                const first = words[0];
                const rest = words.slice(1).join(' ').replace(/[\p{L}\p{N}]/gu, '_ ');
                return `${first} ${rest}`;
            } else {
                return cleanTitle.substring(0, 2) + cleanTitle.substring(2).replace(/[\p{L}\p{N}]/gu, '_ ');
            }
        }
        return '';
    };

    const handleQuitRequest = () => {
        setShowQuitConfirm(true);
    };

    const forceQuitToMenu = () => {
        setStatus('MENU');
        setSearchInput('');
        setArtistCandidates([]);
        setCurrentArtist(null);
        setPlayedIds([]);
        setShowQuitConfirm(false);
    };

    const confirmQuit = () => {
        setShowQuitConfirm(false);
        setStatus('MENU');
        setSearchInput('');
        setArtistCandidates([]);
        setCurrentArtist(null);
        setPlayedIds([]);
    };

    const getLossMessage = () => {
        switch (lossReason) {
            case 'TIME_UP': return "TIME'S UP";
            case 'SKIP': return "SKIPPED";
            case 'OUT_OF_GUESSES': return "GAME OVER";
            default: return "LOST";
        }
    };

    return (
        <div className="min-h-screen bg-theme-bg text-white font-sans flex flex-col relative overflow-x-hidden">

            {toastMessage && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[70] animate-fade-in">
                    <div className="bg-red-500/90 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold backdrop-blur-md border border-white/10">
                        <AlertCircle size={18} />
                        <span className="text-sm">{toastMessage}</span>
                    </div>
                </div>
            )}

            <nav className="w-full flex justify-between items-center px-6 py-4 absolute top-0 left-0 z-20 pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto cursor-pointer" onClick={forceQuitToMenu}>
                    <Disc className="text-theme-pink animate-[spin_10s_linear_infinite]" size={24} />
                    <span className="font-black text-xl tracking-tighter">PIXEL<span className="text-theme-purple">COVER</span></span>
                </div>

                <div className="flex items-center gap-3 pointer-events-auto">
                    <div className="flex items-center gap-2 bg-zinc-900/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5 shadow-lg">
                        <Zap size={14} className="text-yellow-400 fill-yellow-400" />
                        <span className="font-bold font-mono text-sm">{score}</span>
                    </div>

                    {status !== 'MENU' && status !== 'ALL_CLEARED' && (
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

                {status === 'ALL_CLEARED' && (
                    <div className="w-full flex flex-col items-center animate-fade-in text-center gap-6">
                        <div className="w-24 h-24 bg-theme-purple/20 rounded-full flex items-center justify-center mb-4 ring-4 ring-theme-purple/50">
                            <Trophy className="text-theme-purple w-12 h-12" />
                        </div>
                        <h1 className="text-4xl font-black text-white">ALL CLEARED!</h1>
                        <p className="text-zinc-400 max-w-xs">You have guessed every song in {currentArtist?.name}'s collection for this difficulty.</p>
                        <button
                            onClick={confirmQuit}
                            className="bg-white text-black hover:bg-zinc-200 px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center gap-2"
                        >
                            Back to Menu
                        </button>
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

                        <div className="flex flex-col items-center gap-4 mb-2">
                            <div className="flex justify-center gap-2">
                                {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map((level) => (
                                    <button
                                        key={level}
                                        onClick={() => setDifficulty(level)}
                                        className={`px-4 py-2 rounded-lg font-bold text-xs tracking-wider transition-all border ${difficulty === level
                                            ? 'bg-white text-black border-white'
                                            : 'bg-transparent text-zinc-500 border-white/10 hover:bg-white/5'
                                            }`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setEnableTimer(!enableTimer)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs tracking-wider transition-all border ${enableTimer
                                    ? 'bg-theme-purple/20 text-theme-purple border-theme-purple/50'
                                    : 'bg-transparent text-zinc-500 border-white/10 hover:bg-white/5'
                                    }`}
                            >
                                <Timer size={14} /> {enableTimer ? 'TIMER ON' : 'TIMER OFF'}
                            </button>
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

                {status !== 'MENU' && status !== 'ALL_CLEARED' && targetAlbum && (
                    <div className="w-full flex flex-col items-center animate-fade-in w-full max-w-sm gap-6 mt-8">

                        <div className="text-center w-full">
                            <h3 className="text-2xl font-black uppercase tracking-tight text-white">
                                {targetAlbum.artistName}
                            </h3>
                            <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                                <p className="text-theme-purple text-xs font-bold tracking-widest uppercase opacity-80">
                                    Guess the {targetAlbum.type}
                                </p>
                                <span className="bg-zinc-800 text-zinc-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{difficulty}</span>
                            </div>

                            {enableTimer && (status === 'PLAYING' || status === 'WON') && (
                                <div className="w-full mt-4 flex items-center gap-3">
                                    <Clock size={14} className={`${timeLeft <= 5 && status === 'PLAYING' ? 'text-red-500 animate-pulse' : 'text-zinc-500'}`} />
                                    <div className="flex-1 h-2 bg-zinc-900 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 linear ${timeLeft <= 5 ? 'bg-red-500' : 'bg-theme-purple'}`}
                                            style={{ width: `${(timeLeft / TIMER_SETTINGS[difficulty]) * 100}%` }}
                                        ></div>
                                    </div>
                                    <span className={`font-mono text-xs font-bold ${timeLeft <= 5 ? 'text-red-500' : 'text-zinc-500'}`}>{timeLeft}s</span>
                                </div>
                            )}
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
                                        <div className="flex flex-col gap-1 mt-2">
                                            <div className="flex items-center justify-center gap-2 text-white font-mono text-sm">
                                                <Zap className="fill-yellow-400 text-yellow-400" size={14} />
                                                <span>+{difficulty === 'EASY' ? 100 : difficulty === 'MEDIUM' ? 150 : 200} PTS</span>
                                            </div>
                                            {enableTimer && timeLeft > 0 && (
                                                <div className="flex items-center justify-center gap-2 text-theme-purple font-mono text-xs font-bold">
                                                    <Clock size={12} />
                                                    <span>+{timeLeft * 10} SPEED BONUS</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {status === 'LOST' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-red-900/30 backdrop-blur-sm animate-fade-in border-2 border-red-500 z-10">
                                    <div className="bg-black/90 px-6 py-4 border border-red-500 text-center shadow-2xl rounded-xl">
                                        <h2 className="text-3xl font-black text-red-500 uppercase tracking-tighter">
                                            {getLossMessage()}
                                        </h2>
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
                                {hintLevel !== 'NONE' && (
                                    <div className="flex flex-col gap-1 items-center animate-fade-in">
                                        <div className="text-center font-mono text-theme-pink tracking-[0.2em] text-lg break-words">
                                            {getHintText()}
                                        </div>
                                        {getExtraInfoHint()}
                                    </div>
                                )}

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

                                <div className="flex justify-between items-center px-1">
                                    <button
                                        onClick={handleHint}
                                        disabled={hintLevel === 'FIRST_WORD'}
                                        className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-zinc-500"
                                    >
                                        <HelpCircle size={14} />
                                        {hintLevel === 'NONE' ? 'HINT (-25 XP)' : hintLevel === 'MASKED' ? 'MORE HINT (-25 XP)' : 'MAX HINT'}
                                    </button>

                                    {lastWrongGuess && (
                                        <div className="text-red-400 text-xs text-center animate-bounce-small flex items-center justify-center gap-1.5 font-medium absolute left-1/2 transform -translate-x-1/2">
                                            <XCircle size={12} />
                                            <span>Incorrect</span>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSkip}
                                        className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-red-400 transition-colors"
                                    >
                                        SKIP (-50 XP) <SkipForward size={14} />
                                    </button>
                                </div>
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

            <div className="fixed bottom-2 right-4 text-zinc-700 text-[10px] font-bold z-50 pointer-events-none">Created by Yali</div>
            <div className="fixed bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black to-transparent pointer-events-none z-0"></div>
        </div>
    );
};

export default App;