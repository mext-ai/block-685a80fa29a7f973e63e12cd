import React, { useEffect, useState, useRef, useCallback } from 'react';

interface BlockProps {
  title?: string;
}

interface Ball {
  x: number;
  y: number;
  velocityY: number;
  velocityX: number; // Nouvelle propriété pour la vélocité horizontale
  radius: number;
}

const Block: React.FC<BlockProps> = ({ title = "Jeu de Jonglage" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'gameOver'>('waiting');
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [ball, setBall] = useState<Ball>({
    x: 400,
    y: 100,
    velocityY: 0,
    velocityX: 0, // Initialiser la vélocité horizontale
    radius: 30
  });

  const GRAVITY = 0.5;
  const JUMP_FORCE = -12;
  const HORIZONTAL_DAMPING = 0.98; // Amortissement horizontal pour réalisme
  const MAX_HORIZONTAL_VELOCITY = 8; // Vitesse horizontale maximale

  // Fonction pour ajuster la taille du canvas à l'écran
  const updateCanvasSize = useCallback(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      setCanvasSize({ width, height });
      
      // Ajuster la position du ballon si nécessaire
      setBall(prevBall => ({
        ...prevBall,
        x: Math.min(prevBall.x, width - prevBall.radius),
        y: Math.min(prevBall.y, height - 100)
      }));
    }
  }, []);

  // Écouter les changements de taille
  useEffect(() => {
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [updateCanvasSize]);

  const GROUND_Y = canvasSize.height - 50;

  // Fonction pour démarrer le jeu
  const startGame = useCallback(() => {
    setGameState('playing');
    setScore(0);
    setBall({
      x: canvasSize.width / 2,
      y: 100,
      velocityY: 2,
      velocityX: 0,
      radius: 30
    });
    
    // Envoyer l'événement de début si nécessaire
    window.postMessage({ type: 'BLOCK_COMPLETION', blockId: 'football-juggling-game', completed: false }, '*');
    window.parent.postMessage({ type: 'BLOCK_COMPLETION', blockId: 'football-juggling-game', completed: false }, '*');
  }, [canvasSize.width]);

  // Fonction pour redémarrer le jeu
  const restartGame = useCallback(() => {
    setGameState('waiting');
    setBall({
      x: canvasSize.width / 2,
      y: 100,
      velocityY: 0,
      velocityX: 0,
      radius: 30
    });
  }, [canvasSize.width]);

  // Fonction pour gérer les clics sur le canvas
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasSize.width / rect.width;
    const scaleY = canvasSize.height / rect.height;
    
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;

    // Vérifier si le clic est sur le ballon - Zone de clic plus généreuse
    // et s'assurer que le ballon n'a pas encore touché le sol
    const distance = Math.sqrt(
      Math.pow(clickX - ball.x, 2) + Math.pow(clickY - ball.y, 2)
    );

    // Le ballon est cliquable tant qu'il n'a pas touché le sol ET qu'on clique dans sa zone
    // Zone de clic élargie pour une meilleure jouabilité - AUGMENTÉE de 30 à 40
    const clickRadius = ball.radius + 40; // Zone de clic encore plus large
    const ballHasTouchedGround = (ball.y + ball.radius) >= GROUND_Y;

    if (distance <= clickRadius && !ballHasTouchedGround) {
      // Calculer la direction horizontale - INVERSÉE pour plus de réalisme
      // Si on clique à gauche du centre (horizontalOffset < 0), le ballon part à droite (+)
      // Si on clique à droite du centre (horizontalOffset > 0), le ballon part à gauche (-)
      const horizontalOffset = clickX - ball.x; // Distance du clic par rapport au centre du ballon
      const horizontalForce = -(horizontalOffset / ball.radius) * MAX_HORIZONTAL_VELOCITY; // INVERSÉ avec le signe -
      
      setBall(prevBall => ({
        ...prevBall,
        velocityY: JUMP_FORCE,
        velocityX: Math.max(-MAX_HORIZONTAL_VELOCITY, Math.min(MAX_HORIZONTAL_VELOCITY, horizontalForce))
      }));
      setScore(prevScore => prevScore + 1);
    }
  }, [gameState, ball.x, ball.y, ball.radius, canvasSize, GROUND_Y]);

  // Animation du jeu
  useEffect(() => {
    if (gameState !== 'playing') return;

    const animate = () => {
      setBall(prevBall => {
        let newBall = { ...prevBall };
        
        // Appliquer la gravité
        newBall.velocityY += GRAVITY;
        newBall.y += newBall.velocityY;
        
        // Appliquer le mouvement horizontal
        newBall.x += newBall.velocityX;
        
        // Appliquer l'amortissement horizontal pour plus de réalisme
        newBall.velocityX *= HORIZONTAL_DAMPING;

        // Vérifier si le ballon touche le sol - vérification plus précise
        if (newBall.y + newBall.radius >= GROUND_Y) {
          // S'assurer que le ballon est exactement sur le sol
          newBall.y = GROUND_Y - newBall.radius;
          setGameState('gameOver');
          // Envoyer l'événement de completion du jeu
          window.postMessage({ 
            type: 'BLOCK_COMPLETION', 
            blockId: 'football-juggling-game', 
            completed: true,
            score: score,
            data: { finalScore: score, gameType: 'juggling' }
          }, '*');
          window.parent.postMessage({ 
            type: 'BLOCK_COMPLETION', 
            blockId: 'football-juggling-game', 
            completed: true,
            score: score,
            data: { finalScore: score, gameType: 'juggling' }
          }, '*');
          return newBall;
        }

        // Rebondir sur les murs latéraux avec perte d'énergie
        if (newBall.x - newBall.radius < 0) {
          newBall.x = newBall.radius;
          newBall.velocityX = -newBall.velocityX * 0.7; // Rebond avec perte d'énergie
        } else if (newBall.x + newBall.radius > canvasSize.width) {
          newBall.x = canvasSize.width - newBall.radius;
          newBall.velocityX = -newBall.velocityX * 0.7; // Rebond avec perte d'énergie
        }

        return newBall;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, score, GROUND_Y, canvasSize.width]);

  // Fonction de dessin
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Effacer le canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Dessiner le fond (terrain de football)
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasSize.height);
    gradient.addColorStop(0, '#87CEEB'); // Ciel bleu
    gradient.addColorStop(0.7, '#87CEEB');
    gradient.addColorStop(1, '#228B22'); // Herbe verte
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Dessiner le sol
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, GROUND_Y, canvasSize.width, canvasSize.height - GROUND_Y);

    // Dessiner les lignes du terrain
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    // Ligne de but
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(canvasSize.width, GROUND_Y);
    ctx.stroke();

    // Dessiner le ballon de football avec rotation basée sur la vélocité
    ctx.save();
    ctx.translate(ball.x, ball.y);
    
    // Rotation du ballon basée sur la vélocité horizontale pour plus de réalisme
    const rotationAngle = (ball.velocityX * 0.1) % (Math.PI * 2);
    ctx.rotate(rotationAngle);
    
    const ballGradient = ctx.createRadialGradient(-10, -10, 0, 0, 0, ball.radius);
    ballGradient.addColorStop(0, '#FFFFFF');
    ballGradient.addColorStop(1, '#000000');
    
    ctx.fillStyle = ballGradient;
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Dessiner les motifs du ballon
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    // Pentagones
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const x1 = Math.cos(angle) * (ball.radius * 0.3);
      const y1 = Math.sin(angle) * (ball.radius * 0.3);
      const x2 = Math.cos(angle + Math.PI * 2/5) * (ball.radius * 0.3);
      const y2 = Math.sin(angle + Math.PI * 2/5) * (ball.radius * 0.3);
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    
    ctx.restore();

    // Dessiner un indicateur visuel de la zone de clic si le jeu est en cours
    // et si le ballon est proche du sol pour aider le joueur - MISE À JOUR pour refléter la nouvelle taille
    if (gameState === 'playing' && (ball.y + ball.radius) > (GROUND_Y - 100)) {
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius + 40, 0, Math.PI * 2); // Mis à jour pour correspondre à la zone de clic
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Afficher un indicateur visuel de la direction si le ballon bouge horizontalement
    if (gameState === 'playing' && Math.abs(ball.velocityX) > 0.5) {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      
      const arrowLength = Math.min(50, Math.abs(ball.velocityX) * 8);
      const arrowDirection = ball.velocityX > 0 ? 1 : -1;
      
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y - ball.radius - 10);
      ctx.lineTo(ball.x + (arrowLength * arrowDirection), ball.y - ball.radius - 10);
      
      // Pointe de flèche
      ctx.lineTo(ball.x + (arrowLength * arrowDirection) - (10 * arrowDirection), ball.y - ball.radius - 15);
      ctx.moveTo(ball.x + (arrowLength * arrowDirection), ball.y - ball.radius - 10);
      ctx.lineTo(ball.x + (arrowLength * arrowDirection) - (10 * arrowDirection), ball.y - ball.radius - 5);
      
      ctx.stroke();
      ctx.setLineDash([]);
    }

  }, [ball, gameState, canvasSize, GROUND_Y]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #2E8B57 0%, #228B22 50%, #006400 100%)',
      color: 'white',
      fontFamily: "'Arial Black', Arial, sans-serif",
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Effet de terrain en arrière-plan */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          repeating-linear-gradient(
            90deg,
            transparent,
            transparent 95px,
            rgba(255, 255, 255, 0.1) 95px,
            rgba(255, 255, 255, 0.1) 100px
          ),
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 95px,
            rgba(255, 255, 255, 0.1) 95px,
            rgba(255, 255, 255, 0.1) 100px
          )
        `,
        opacity: 0.3,
        zIndex: 0
      }}></div>

      {/* Score fixe en haut */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        fontSize: '1.8rem',
        padding: '15px 30px',
        background: 'linear-gradient(45deg, #1a1a2e, #16213e)',
        borderRadius: '15px',
        border: '3px solid #FFD700',
        boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
        minWidth: '200px',
        textAlign: 'center'
      }}>
        <div style={{ color: '#FFD700', fontSize: '1rem', marginBottom: '5px' }}>SCORE</div>
        <div style={{ fontWeight: 'bold', color: '#FFFFFF' }}>
          {score} point{score !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Canvas de jeu - prend tout l'espace */}
      <div 
        ref={containerRef}
        style={{ 
          flex: 1,
          position: 'relative',
          zIndex: 1
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={handleCanvasClick}
          style={{
            width: '100%',
            height: '100%',
            cursor: gameState === 'playing' ? 'pointer' : 'default',
            backgroundColor: '#87CEEB',
            display: 'block'
          }}
        />
      </div>

      {/* Menu de démarrage - centré sur l'écran */}
      {gameState === 'waiting' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 20,
          textAlign: 'center',
          padding: '40px',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          borderRadius: '25px',
          border: '3px solid #FFD700',
          boxShadow: '0 15px 35px rgba(0,0,0,0.7)',
          backdropFilter: 'blur(10px)',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto'
        }}>
          {/* Titre principal */}
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            margin: '0 0 15px 0',
            background: 'linear-gradient(45deg, #FFD700, #FFA500, #FF6347)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 20px rgba(255, 215, 0, 0.8)',
            letterSpacing: '2px',
            fontWeight: 'bold'
          }}>
            ⚽ FOOTBALL JUGGLING ⚽
          </h1>
          
          <div style={{
            fontSize: 'clamp(1rem, 3vw, 1.2rem)',
            color: '#FFD700',
            fontStyle: 'italic',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
            marginBottom: '30px'
          }}>
            🏆 Championship Edition 🏆
          </div>

          {/* Instructions */}
          <div style={{
            background: 'linear-gradient(45deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.2))',
            padding: '25px',
            borderRadius: '15px',
            marginBottom: '30px',
            border: '1px solid rgba(255, 215, 0, 0.5)'
          }}>
            <p style={{ 
              fontSize: 'clamp(1rem, 2.5vw, 1.3rem)', 
              margin: '0',
              lineHeight: '1.6'
            }}>
              🎯 <strong>OBJECTIF :</strong> Gardez le ballon en l'air !<br/>
              👆 <strong>CONTRÔLES :</strong> Cliquez sur le ballon pour le faire rebondir<br/>
              🎮 <strong>TECHNIQUE :</strong> Frappez le côté gauche → ballon va à droite<br/>
              🏆 <strong>DÉFI :</strong> Évitez que le ballon touche le sol !
            </p>
          </div>
          
          {/* Ballon animé */}
          <div style={{
            fontSize: 'clamp(3rem, 8vw, 4rem)',
            marginBottom: '30px',
            animation: 'bounce 2s infinite'
          }}>
            ⚽
          </div>
          
          {/* Bouton de démarrage */}
          <button
            onClick={startGame}
            style={{
              fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
              padding: '20px 40px',
              background: 'linear-gradient(45deg, #4CAF50, #45a049)',
              color: 'white',
              border: '3px solid #2E7D32',
              borderRadius: '15px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 6px 20px rgba(76, 175, 80, 0.4)',
              fontWeight: 'bold',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '20px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(76, 175, 80, 0.6)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.4)';
            }}
          >
            🚀 COUP D'ENVOI ! 🚀
          </button>
          
          <div style={{
            fontSize: 'clamp(0.9rem, 2vw, 1rem)',
            opacity: 0.8,
            fontStyle: 'italic'
          }}>
            ⭐ Montrez vos talents de jongleur ! ⭐
          </div>
        </div>
      )}

      {/* Menu Game Over - centré sur l'écran */}
      {gameState === 'gameOver' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 20,
          textAlign: 'center',
          padding: '40px',
          background: 'linear-gradient(45deg, #d32f2f, #f44336)',
          borderRadius: '25px',
          border: '3px solid #ff6b6b',
          boxShadow: '0 15px 35px rgba(211, 47, 47, 0.7)',
          backdropFilter: 'blur(10px)',
          maxWidth: '90vw'
        }}>
          <div style={{ fontSize: 'clamp(2.5rem, 6vw, 3rem)', marginBottom: '20px' }}>🏁</div>
          <h2 style={{ 
            marginBottom: '20px', 
            fontSize: 'clamp(1.5rem, 4vw, 2rem)', 
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)' 
          }}>
            MATCH TERMINÉ !
          </h2>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '20px',
            borderRadius: '15px',
            marginBottom: '25px'
          }}>
            <p style={{ 
              fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', 
              marginBottom: '15px', 
              fontWeight: 'bold' 
            }}>
              🏆 Score final: {score} point{score !== 1 ? 's' : ''}
            </p>
            <p style={{ 
              margin: '0', 
              fontSize: 'clamp(1rem, 2.5vw, 1.1rem)' 
            }}>
              {score === 0 && "🔥 Échauffement terminé ! Essayez encore !"}
              {score > 0 && score < 5 && "👍 Bon début ! Continuez l'entraînement !"}
              {score >= 5 && score < 10 && "🎉 Bien joué ! Vous progressez !"}
              {score >= 10 && score < 20 && "⭐ Excellent contrôle du ballon !"}
              {score >= 20 && "🏆 LÉGENDE DU FOOTBALL ! Champion !"}
            </p>
          </div>
          <button
            onClick={restartGame}
            style={{
              fontSize: 'clamp(1.2rem, 3vw, 1.5rem)',
              padding: '15px 30px',
              background: 'linear-gradient(45deg, #4CAF50, #45a049)',
              color: 'white',
              border: '2px solid #2E7D32',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
            }}
          >
            🔄 NOUVELLE PARTIE
          </button>
        </div>
      )}

      {/* Animations CSS */}
      <style>{`
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }
      `}</style>
    </div>
  );
};

export default Block;