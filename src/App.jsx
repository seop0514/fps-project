import { useEffect, useRef } from 'react';
import { Game } from './game/Game.js';
import './App.css';

export default function App() {
  const ref = useRef(null);

  useEffect(() => {
    const game = new Game(ref.current);
    return () => game.dispose();
  }, []);

  return (
    <div className="app">
      <div className="game-container" ref={ref} />
    </div>
  );
}
