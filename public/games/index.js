// Collection of games. Each entry declares id, name, description, emoji, and mount function.

import { mountSnake } from './snake.js';
import { mountTwenty48 } from './twenty48.js';
import { mountTetris } from './tetris.js';
import { mountMemory } from './memory.js';
import { mountPong } from './pong.js';
import { mountTicTacToe } from './tictactoe.js';
import { mountBreakout } from './breakout.js';
import { mountMinesweeper } from './minesweeper.js';
import { mountNeonDrift } from './neondrift.js';
import { mountStarblitz } from './starblitz.js';

function mountExternalGame(folder) {
  return (container) => {
    container.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = `/games/${folder}/index.html`;
    iframe.style.width = '100%';
    iframe.style.height = '600px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    iframe.style.background = '#000';
    container.appendChild(iframe);
  };
}

export const GAMES = [
  {
    id: 'neondrift',
    name: 'Neon Drift',
    short: 'Arcade hover-runner with lane swaps and boost.',
    description: 'Thread a neon hoverbike through live traffic, chain near-misses, and ride the boost lane for huge survival scores.',
    emoji: '🏍️',
    multiplayer: false,
    new: true,
    mount: mountNeonDrift,
    theme: 1,
    song: 'Midnight Grind.mp3'
  },
  {
    id: 'starblitz',
    name: 'Starblitz Vanguard',
    short: 'Cinematic space defense with waves and combos.',
    description: 'Pilot a vanguard interceptor, shred attack formations, collect energy cores, and survive escalating deep-space assault waves.',
    emoji: '🚀',
    multiplayer: false,
    new: true,
    mount: mountStarblitz,
    theme: 3,
    song: 'sapan4-edm-gaming-music-335408.mp3'
  },
  {
    id: 'snake',
    name: 'Nexa Snake',
    short: 'Neon survival snake with unlockable skins.',
    description: 'A sharpened version of the classic: faster pacing, cleaner visuals, and unlockable skins as you push for longer survival runs.',
    emoji: '🐍',
    multiplayer: false,
    mount: mountSnake,
    theme: 2,
    song: 'Tropical Bass Land 2.mp3'
  },
  {
    id: '2048',
    name: '2048',
    short: 'Merge tiles to reach 2048.',
    description: 'Combine tiles with matching numbers to reach 2048. Simple rules, addictive play.',
    emoji: '🔢',
    multiplayer: false,
    mount: mountTwenty48,
    theme: 0,
    song: 'Daytime TV Raised.mp3'
  },
  {
    id: 'tetris',
    name: 'Nexa Tetris',
    short: 'Stack falling blocks to clear rows.',
    description: 'The timeless falling-block puzzle. Clear lines, chase combos, and survive increasing speed.',
    emoji: '🟦',
    multiplayer: false,
    mount: mountTetris,
    theme: 4,
    song: 'energysound-powerful-percussion-513717.mp3'
  },
  {
    id: 'memory',
    name: 'Memory Match',
    short: 'Flip cards to find pairs.',
    description: 'Train your memory. Flip two cards at a time and match them all — with the fewest moves.',
    emoji: '🧠',
    multiplayer: false,
    mount: mountMemory,
    theme: 0,
    song: 'lightbeatsmusic-joyful-rhythm-walk-funk-513936.mp3'
  },
  {
    id: 'breakout',
    name: 'Brick Breaker',
    short: 'Glow-lit brick storm with combo rebounds.',
    description: 'A sharper brick-breaker with glow FX, combo momentum, and cleaner paddle feel built for score-chasing sessions.',
    emoji: '🧱',
    multiplayer: false,
    mount: mountBreakout,
    theme: 1,
    song: 'energysound-stomp-action-music-513718.mp3'
  },
  {
    id: 'minesweeper',
    name: 'Minesweeper',
    short: 'Find safe squares. Avoid the mines.',
    description: 'The classic logic puzzle. Reveal numbers to deduce where the mines are. Don\'t click a mine.',
    emoji: '💣',
    multiplayer: false,
    mount: mountMinesweeper,
    theme: 2,
    song: 'Wi‑Fi Fridge.mp3'
  },
  {
    id: 'tictactoe',
    name: 'Tic-Tac-Toe',
    short: 'Real-time 2-player. Share a room code.',
    description: 'Play live tic-tac-toe against a friend. Share the room code and battle in real time.',
    emoji: '❌',
    multiplayer: true,
    mount: mountTicTacToe,
    theme: 3,
    song: 'BigOlHands.m4a'
  },
  {
    id: 'pong',
    name: 'Nexa Pong',
    short: 'The original arcade classic.',
    description: 'Bounce the ball past your opponent. Practice vs AI in single-player.',
    emoji: '🏓',
    multiplayer: true,
    mount: mountPong,
    theme: 4,
    song: 'alec_koff-carnaval-484622.mp3'
  },
  // --- External Games ---
  { id: 'candy-crush', name: 'Candy Crush', short: 'Match candies to win.', emoji: '🍬', mount: mountExternalGame('01-Candy-Crush-Game'), theme: 1, song: 'betty boom boom.mp3' },
  { id: 'pacman', name: 'Pac-Man', short: 'Eat dots and avoid ghosts.', emoji: '🍕', mount: mountExternalGame('02-Pac-Man-Game'), theme: 2, song: 'alexzavesa-dance-playful-night-510786.mp3' },
  { id: 'chess', name: 'Chess', short: 'Classic game of strategy.', emoji: '♟️', mount: mountExternalGame('03-Chess-Game'), theme: 3, song: 'ikoliks_aj-spring-easter-day-music-320427.mp3' },
  { id: 'doodle-jump', name: 'Doodle Jump', short: 'Jump as high as you can.', emoji: '🪜', mount: mountExternalGame('04-Doodle-Jump-Game'), theme: 4, song: 'kontraa-water-afro-pop-music-445661.mp3' },
  { id: 'solitaire', name: 'Solitaire', short: 'Classic card game.', emoji: '🃏', mount: mountExternalGame('05-Solitaire-Game'), theme: 0, song: 'Daytime TV Raised.mp3' },
  { id: 'sudoku', name: 'Sudoku', short: 'Number placement puzzle.', emoji: '🔢', mount: mountExternalGame('06-Sudoku-Game'), theme: 1, song: 'Midnight Grind.mp3' },
  { id: 'crossy-road', name: 'Crossy Road', short: 'Cross the road safely.', emoji: '🐔', mount: mountExternalGame('07-Crossy-Road-Game'), theme: 2, song: 'Tropical Bass Land 2.mp3' },
  { id: 'rps', name: 'Rock Paper Scissors', short: 'The ultimate duel.', emoji: '✊', mount: mountExternalGame('08-Rock-Paper-Scissors'), theme: 3, song: 'yakastreams-retro-gaming-271301.mp3' },
  { id: 'flappy-bird', name: 'Flappy Bird', short: 'Fly through pipes.', emoji: '🐦', mount: mountExternalGame('09-Flappy-Bird-Game'), theme: 4, song: 'Wi‑Fi Fridge.mp3' },
  { id: '2048-ext', name: '2048 Classic', short: 'Original 2048 tiles.', emoji: '🔢', mount: mountExternalGame('10-2048-Game'), theme: 0, song: 'alec_koff-carnaval-484622.mp3' },
  { id: 'wordle', name: 'Wordle', short: 'Guess the daily word.', emoji: '📝', mount: mountExternalGame('11-Wordle-Game'), theme: 1, song: 'alexzavesa-dance-playful-night-510786.mp3' },
  { id: 'hangman', name: 'Hangman', short: 'Guess the word before it\'s too late.', emoji: '🪢', mount: mountExternalGame('12-Hangman-Game'), theme: 2, song: 'betty boom boom.mp3' },
  { id: 'tower-blocks', name: 'Tower Blocks', short: 'Build the tallest tower.', emoji: '🏗️', mount: mountExternalGame('13-Tower-Blocks'), theme: 3, song: 'energysound-powerful-percussion-513717.mp3' },
  { id: 'archery', name: 'Archery', short: 'Hit the bullseye.', emoji: '🏹', mount: mountExternalGame('14-Archery-Game'), theme: 4, song: 'energysound-stomp-action-music-513718.mp3' },
  { id: 'tictactoe-ext', name: 'Tic-Tac-Toe Pro', short: 'Clean board battle.', emoji: '❌', mount: mountExternalGame('15-Tic-Tac-Toe'), theme: 0, song: 'ikoliks_aj-spring-easter-day-music-320427.mp3' },
  { id: 'minesweeper-ext', name: 'Minesweeper Retro', short: 'Classic grid clearing.', emoji: '💣', mount: mountExternalGame('16-Minesweeper-Game'), theme: 1, song: 'kontraa-water-afro-pop-music-445661.mp3' },
  { id: 'speed-typing', name: 'Speed Typing', short: 'How fast can you type?', emoji: '⌨️', mount: mountExternalGame('17-Speed-Typing-Game'), theme: 2, song: 'lightbeatsmusic-joyful-rhythm-walk-funk-513936.mp3' },
  { id: 'breakout-ext', name: 'Breakout Retro', short: 'Classic brick breaking.', emoji: '🧱', mount: mountExternalGame('18-Breakout-Game'), theme: 3, song: 'Daytime TV Raised.mp3' },
  { id: 'ping-pong', name: 'Ping Pong', short: 'Table tennis arcade.', emoji: '🏓', mount: mountExternalGame('19-Ping-Pong-Game'), theme: 4, song: 'Midnight Grind.mp3' },
  { id: 'tetris-ext', name: 'Tetris Retro', short: 'Original block stacker.', emoji: '🟦', mount: mountExternalGame('20-Tetris-Game'), theme: 0, song: 'Tropical Bass Land 2.mp3' },
  { id: 'tilting-maze', name: 'Tilting Maze', short: 'Roll the ball to the exit.', emoji: '🌀', mount: mountExternalGame('21-Tilting-Maze-Game'), theme: 1, song: 'audioknap-dubstep-edm-420040.mp3' },
  { id: 'memory-ext', name: 'Memory Pro', short: 'Card flipping match.', emoji: '🧠', mount: mountExternalGame('22-Memory-Card-Game'), theme: 2, song: 'Wi‑Fi Fridge.mp3' },
  { id: 'number-guess', name: 'Number Guess', short: 'Guess the hidden number.', emoji: '❓', mount: mountExternalGame('23-Type-Number-Guessing-Game'), theme: 3, song: 'alec_koff-carnaval-484622.mp3' },
  { id: 'snake-ext', name: 'Snake Retro', short: 'Classic pixel snake.', emoji: '🐍', mount: mountExternalGame('24-Snake-Game'), theme: 4, song: 'alexzavesa-dance-playful-night-510786.mp3' },
  { id: 'connect-four', name: 'Connect Four', short: 'Get four in a row.', emoji: '🔴', mount: mountExternalGame('25-Connect-Four-Game'), theme: 0, song: 'betty boom boom.mp3' },
  { id: 'insect-catch', name: 'Insect Catch', short: 'Catch them all.', emoji: '🦟', mount: mountExternalGame('26-Insect-Catch-Game'), theme: 1, song: 'energysound-powerful-percussion-513717.mp3' },
  { id: 'typing-hero', name: 'Typing Hero', short: 'Defeat words with speed.', emoji: '⌨️', mount: mountExternalGame('27-Typing-Game'), theme: 2, song: 'energysound-stomp-action-music-513718.mp3' },
  { id: 'dice-roll', name: 'Dice Roll', short: 'Simulator for board games.', emoji: '🎲', mount: mountExternalGame('28-Dice-Roll-Simulator'), theme: 3, song: 'ikoliks_aj-spring-easter-day-music-320427.mp3' },
  { id: 'shape-clicker', name: 'Shape Clicker', short: 'Click the right shapes.', emoji: '🔺', mount: mountExternalGame('29-Shape-Clicker-Game'), theme: 4, song: 'kontraa-water-afro-pop-music-445661.mp3' },
  { id: 'typing-pro', name: 'Typing Pro', short: 'Advanced typing test.', emoji: '⌨️', mount: mountExternalGame('30-Typing-Game'), theme: 0, song: 'lightbeatsmusic-joyful-rhythm-walk-funk-513936.mp3' },
  { id: 'speak-guess', name: 'Voice Guess', short: 'Guess with your voice.', emoji: '🗣️', mount: mountExternalGame('31-Speak-Number-Guessing-Game'), theme: 1, song: 'Daytime TV Raised.mp3' },
  { id: 'fruit-slicer', name: 'Fruit Slicer', short: 'Slice the fruit fast.', emoji: '🍎', mount: mountExternalGame('32-Fruit-Slicer-Game'), theme: 2, song: 'Midnight Grind.mp3' },
  { id: 'quiz', name: 'Quiz Master', short: 'Test your knowledge.', emoji: '💡', mount: mountExternalGame('33-Quiz-Game'), theme: 3, song: 'Tropical Bass Land 2.mp3' },
  { id: 'emoji-catcher', name: 'Emoji Catcher', short: 'Catch falling emojis.', emoji: '😃', mount: mountExternalGame('34-Emoji-Catcher-Game'), theme: 4, song: 'magpiemusic-action-trailer-promo-rock-513687.mp3' },
  { id: 'whack-a-mole', name: 'Whack-A-Mole', short: 'Hit them as they pop up.', emoji: '🔨', mount: mountExternalGame('35-Whack-A-Mole-Game'), theme: 0, song: 'Wi‑Fi Fridge.mp3' },
  { id: 'simon-says', name: 'Simon Says', short: 'Repeat the pattern.', emoji: '🔵', mount: mountExternalGame('36-Simon-Says-Game'), theme: 1, song: 'alec_koff-carnaval-484622.mp3' },
  { id: 'sliding-puzzle', name: 'Sliding Puzzle', short: 'Rearrange the tiles.', emoji: '🧩', mount: mountExternalGame('37-Sliding-Puzzle-Game'), theme: 2, song: 'alexzavesa-dance-playful-night-510786.mp3' },
  { id: 'hextris', name: 'Hextris', short: 'Hexagonal block puzzle.', emoji: '🛑', mount: mountExternalGame('hextris-gh-pages/hextris-gh-pages'), theme: 1, song: 'ikoliks_aj-spring-easter-day-music-320427.mp3' },
  { id: 'aviator', name: 'The Aviator', short: 'Cinematic flight simulator.', emoji: '🛩️', mount: mountExternalGame('TheAviator-master'), theme: 3, song: 'paulyudin-epic-dubstep-dramatic-shadow-rising-475329.mp3' },
];

export function findGame(id) { return GAMES.find(g => g.id === id); }
