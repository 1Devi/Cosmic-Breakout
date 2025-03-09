class StarField {
    constructor(game) {
        this.game = game;
        this.layers = [];
        this.initLayers(true); // Инициализация с полным покрытием
    }

	initLayers() {
	  this.layers = [];
	  const {width, height} = this.game.canvas;
	  
	  for(let i = 0; i < 3; i++) {
		this.layers.push({
		  stars: Array.from({length: 200}, () => ({
			x: Math.random() * width,
			y: Math.random() * (height + 400) - 200, // +400/-200 для перекрытия
			size: 0.5 + i*0.7,
			phase: Math.random() * Math.PI*2,
			speed: 0.3 + i*0.4,
			opacity: 0.4 + i*0.2
		  }))
		});
	  }
	}

    createStar(layerIdx, fullCoverage) {
        return {
            x: fullCoverage 
                ? Math.random() * this.game.canvas.width 
                : Math.random() * this.game.canvas.width * 0.2,
            y: Math.random() * this.game.canvas.height,
            size: 1 + layerIdx * 0.5,
            blink: Math.random() > 0.8,
            seed: Math.random() * 1000 // Для уникальной анимации
        };
    }

	update(dt) {
	  this.layers.forEach((layer, i) => {
		layer.stars.forEach(star => {
		  // Анимация мерцания
		  star.phase += dt * (2 + i);
		  star.currentSize = star.size * (0.8 + Math.sin(star.phase)*0.3);
		  
		  // Движение
		  star.y += star.speed * dt * 80;
		  
		  // Циклическое обновление позиции
		  if(star.y > this.game.canvas.height + 200) {
			star.y = -200;
			star.x = Math.random() * this.game.canvas.width;
		  }
		});
	  });
	}

	draw(ctx) {
	  this.layers.forEach((layer, i) => {
		ctx.save();
		layer.stars.forEach(star => {
		  const hue = 220 + Math.sin(star.phase)*30;
		  const alpha = 0.3 + Math.sin(star.phase*0.7)*0.2;
		  
		  // Основная звезда
		  ctx.beginPath();
		  ctx.arc(star.x, star.y, star.currentSize, 0, Math.PI*2);
		  ctx.fillStyle = `hsla(${hue}, 70%, ${70 + i*10}%, ${alpha})`;
		  ctx.fill();
		  
		  // Свечение
		  ctx.beginPath();
		  ctx.arc(star.x, star.y, star.currentSize*4, 0, Math.PI*2);
		  const gradient = ctx.createRadialGradient(
			star.x, star.y, 0, 
			star.x, star.y, star.currentSize*4
		  );
		  gradient.addColorStop(0, `hsla(${hue}, 60%, 80%, ${alpha*0.4})`);
		  gradient.addColorStop(1, `hsla(${hue}, 60%, 80%, 0)`);
		  ctx.fillStyle = gradient;
		  ctx.fill();
		});
		ctx.restore();
	  });
	}

    getStarColor(layer) {
        const colors = ['#FFFFFF', '#00F3FF', '#FF00FF'];
        return colors[layer.speed < 0.5 ? 0 : layer.speed < 0.8 ? 1 : 2];
    }
}

class PostProcessor {
    constructor(game) {
        this.game = game;
        this.offScreenCanvas = document.createElement('canvas');
        this.offScreenCtx = this.offScreenCanvas.getContext('2d');
		game.postProcessors.push(this);
        this.resize();
    }

	resize() {
		this.offScreenCanvas.width = this.game.canvas.width;
		this.offScreenCanvas.height = this.game.canvas.height;
	  
		// Добавить обработчик изменения размера окна
		window.addEventListener('resize', () => {
			this.offScreenCanvas.width = this.game.canvas.width;
			this.offScreenCanvas.height = this.game.canvas.height;
		});
	}

    applyEffects() {
        const {ctx, width, height} = this.game;
        
        // 1. Bloom эффект
        this.applyBloom();
        
        // 2. CRT-эффекты
        this.drawCRTEffect();
        
        // 3. Виньетирование
        this.drawVignette();
    }

  applyBloom() {
    const {ctx, canvas} = this.game;
    
    // 1. Очистка буфера
    this.offScreenCtx.clearRect(0, 0, canvas.width, canvas.height);
    this.offScreenCtx.drawImage(canvas, 0, 0);

    // 2. Корректное применение эффекта
    ctx.save();
    ctx.filter = 'blur(10px) brightness(1.5)';
    ctx.globalCompositeOperation = 'lighten';
    ctx.drawImage(
      this.offScreenCanvas,
      0,
      0,
      canvas.width,
      canvas.height,
      -this.game.camera.offsetX,
      -this.game.camera.offsetY,
      canvas.width,
      canvas.height
    );
    ctx.restore();
  }

    drawCRTEffect() {
        const {ctx, canvas} = this.game;
        
        // Сканирующие линии
        ctx.fillStyle = this.createScanlinePattern();
        ctx.globalAlpha = 0.1;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Цветовые каналы смещение
        const offset = 1 + Math.sin(performance.now() * 0.002) * 0.5;
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.drawImage(canvas, offset, 0);
        ctx.drawImage(canvas, -offset, 0);
        ctx.restore();
    }

    createScanlinePattern() {
        const pattern = document.createElement('canvas');
        const pctx = pattern.getContext('2d');
        pattern.width = 2;
        pattern.height = 4;
        
        pctx.fillStyle = 'rgba(0,0,0,0.3)';
        pctx.fillRect(0, 0, 2, 2);
        return this.game.ctx.createPattern(pattern, 'repeat');
    }

    drawVignette() {
        const {ctx, canvas} = this.game;
        const gradient = ctx.createRadialGradient(
            canvas.width/2, canvas.height/2, 0,
            canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height)/2
        );
        
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(1, 'rgba(0, 0, 20, 0.7)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

class SoundManager {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.sfxGain = this.audioContext.createGain();
        this.musicGain = this.audioContext.createGain();
        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        
        this.sounds = new Map();
        this.currentMusic = null;
        this.initBaseSounds();
        this.initMusicGenerator();
		this.musicTimers = {};
		document.getElementById('music-slider').addEventListener('input', e => {
            this.setMusicVolume(e.target.value);
        });
        document.getElementById('sfx-slider').addEventListener('input', e => {
            this.setSFXVolume(e.target.value);
        });
    }

	initBaseSounds() {
		this.addSound('hit', this.createHitSound());
		this.addSound('block-break', this.createBlockBreakSound());
		this.addSound('lose-life', this.createLoseLifeSound());
		this.addSound('wall-hit', this.createWallHitSound());
		this.addSound('victory', this.createVictorySound());
	}

	setSFXVolume(volume) {
        this.sfxGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }

    setMusicVolume(volume) {
        this.musicGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }

	createLoseLifeSound() {
		return () => {
			const oscillator = this.audioContext.createOscillator();
			const gainNode = this.audioContext.createGain();
			
			oscillator.type = 'sine';
			oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime);
			
			gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
			gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1.2);

			oscillator.connect(gainNode);
			gainNode.connect(this.sfxGain);

			oscillator.start();
			oscillator.stop(this.audioContext.currentTime + 1.2);
		};
	}

	createVictorySound() {
		return () => {
			const duration = 2.5;
			const oscillator = this.audioContext.createOscillator();
			const gainNode = this.audioContext.createGain();
			
			oscillator.type = 'sine';
			oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
			oscillator.frequency.exponentialRampToValueAtTime(1760, this.audioContext.currentTime + duration);
			
			gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
			gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

			oscillator.connect(gainNode);
			gainNode.connect(this.sfxGain);

			oscillator.start();
			oscillator.stop(this.audioContext.currentTime + duration);
		};
	}

    createHitSound() {
        return (speed) => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.type = 'square';
            oscillator.frequency.value = 100 + (speed * 0.2);
            
            gainNode.gain.setValueAtTime(0.1 * Math.min(speed/800, 1), this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);

            oscillator.connect(gainNode);
            gainNode.connect(this.sfxGain);

            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.3);
        };
    }

	createWallHitSound() {
		return () => {
			const now = this.audioContext.currentTime;
			const oscillator = this.audioContext.createOscillator();
			const gainNode = this.audioContext.createGain();
			
			oscillator.type = 'square';
			oscillator.frequency.setValueAtTime(800 + Math.random()*400, now);
			
			gainNode.gain.setValueAtTime(0.15, now);
			gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

			oscillator.connect(gainNode);
			gainNode.connect(this.sfxGain);

			oscillator.start(now);
			oscillator.stop(now + 0.1);
		};
	}

    createBlockBreakSound() {
        return () => {
            const duration = 0.5;
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(50 + Math.random()*200, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

            const panNode = this.audioContext.createStereoPanner();
            panNode.pan.setValueAtTime(Math.random()*2 -1, this.audioContext.currentTime);

            oscillator.connect(panNode);
            panNode.connect(gainNode);
            gainNode.connect(this.sfxGain);

            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }

    initMusicGenerator() {
        this.musicPatterns = {
            bass: { interval: 750, note: 36 },
            harmony: { interval: 1500, note: 48 },
            melody: { interval: 3000, note: 60 }
        };
        this.musicTimers = {};
    }

    updateMusic(time) {
        if(!this.currentMusic) return;
        
        const delta = time - this.lastMusicUpdate;
        this.lastMusicUpdate = time;

        Object.entries(this.musicPatterns).forEach(([name, pattern]) => {
            this.musicTimers[name] = (this.musicTimers[name] || 0) + delta;
            if(this.musicTimers[name] >= pattern.interval) {
                this.playMusicNote(pattern.note + Math.floor(Math.random()*12));
                this.musicTimers[name] = 0;
            }
        });
        
        requestAnimationFrame(this.updateMusic.bind(this));
    }

    playMusicNote(note) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(this.midiToFreq(note), this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1.5);

        oscillator.connect(gainNode);
        gainNode.connect(this.musicGain);

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 1.5);
    }

    midiToFreq(note) {
        return 440 * Math.pow(2, (note - 69)/12);
    }

    addSound(name, generator) {
        this.sounds.set(name, generator);
    }

    play(name, params) {
        if(!this.sounds.has(name)) return;
        this.sounds.get(name)(params);
    }

    setVolume(volume) {
        this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }
	
	toggleMusic(state) {
		if(state) {
			if(!this.currentMusic) {
				this.musicTimers = {};
				this.lastMusicUpdate = performance.now();
				this.currentMusic = true;
				this.updateMusic(performance.now());
			}
		} else {
			this.currentMusic = null;
		}
	}
}

class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.lastTime = 0;
        this.deltaTime = 0;
		this.postProcessors = [];
        
        this.paddle = new Paddle(this);
        this.ball = new Ball(this);
        this.blocks = new BlockManager(this);
		this.resize();
        this.starField = new StarField(this);
        this.postProcessor = new PostProcessor(this);
        this.particles = new ParticleSystem(this);
        this.soundManager = new SoundManager();
        this.soundManager.setVolume(1);

        // Инициализация камеры
        this.camera = {
            offsetX: 0,
            offsetY: 0,
            shake: 0
        };

        // Состояние игры
        this.score = 0;
        this.lives = 3;
        this.combo = 1;
        this.isRunning = false;
        this.isPaused = false;
		
		// Инициализация интерфейса
		this.handleVisibilityChange();
        this.updateScoreDisplay();
        this.updateLivesDisplay();
        this.init();
    }

	init() {
		this.setupEventListeners();
		this.blocks.generateLevel(false);
		this.gameLoop(0);
	}

	setupEventListeners() {
		window.addEventListener('resize', () => this.resize());
        document.addEventListener('keydown', e => this.handleInput(e));
        document.addEventListener('mousemove', e => this.handleMouse(e));
        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            this.handleMouse(e.touches[0]);
        });

        // Кнопки интерфейса
        document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
        document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
        document.getElementById('btn-restart').addEventListener('click', () => this.restartGame());
    }

	resize() {
        const prevState = {
            score: this.score,
            lives: this.lives,
            combo: this.combo,
            isRunning: this.isRunning
        };

        // Обновляем уровень с сохранением состояния
        this.blocks.generateLevel(true);
        
        // Восстанавливаем состояние
        this.score = prevState.score;
        this.lives = prevState.lives;
        this.combo = prevState.combo;
        this.isRunning = false; // Принудительная остановка
        if (prevState.isRunning) this.startGame();
		
		const targetRatio = 16/9;
		const width = Math.min(window.innerWidth, window.innerHeight * targetRatio);
		const height = width / targetRatio;
		
		this.canvas.width = Math.max(width, 800);
		this.canvas.height = Math.max(height, 450);

		// Обновляем только геометрию блоков
		if(this.blocks) this.blocks.resize(); 

		// Обновить звездное поле
		if(this.starField) this.starField.initLayers(true);
        
        // Центрируем игровые объекты
        this.paddle.resize();
        this.ball.reset();
        
        // Генерируем новый уровень с новыми параметрами
        this.blocks.generateLevel(true);
    }


    handleInput(e) {
		if (e.key === ' ') {
			if (!this.isRunning && this.lives > 0) {
				// Добавить проверку наличия блоков
				if (this.blocks.blocks.length > 0) {
					this.startGame();
				}
			}
		}

        const speed = 800;
        if (e.key === 'ArrowLeft') this.paddle.move(-speed);
        if (e.key === 'ArrowRight') this.paddle.move(speed);
    }

    handleMouse(e) {
        const rect = this.canvas.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        this.paddle.moveTo(pos);
    }
	
	handleVisibilityChange() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.lastTime = performance.now();
                this.resize();
            }
        });
    }

	startGame() {
		if (!this.isRunning) {
			this.isRunning = true;
			this.ball.launch();
			if (!this.isPaused) {
				this.soundManager.toggleMusic(true);
			}
		}
	}

    togglePause() {
        this.isPaused = !this.isPaused;
        document.getElementById('pause-modal').style.display = 
            this.isPaused ? 'flex' : 'none';
		this.soundManager.toggleMusic(!this.isPaused);
    }

	restartGame() {
		this.isRunning = false;
		this.score = 0;
		this.lives = 3;
		this.combo = 1;
		this.blocks.generateLevel(false);
		this.ball.reset();
		this.updateScoreDisplay();
		this.updateLivesDisplay();
		this.togglePause();
		this.soundManager.toggleMusic(true);
	}

    gameLoop(timestamp) {
        if (document.visibilityState === 'hidden') {
            this.lastTime = timestamp; // Сохраняем корректное время
            requestAnimationFrame(this.gameLoop.bind(this));
            return;
        }
        this.deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (!this.isPaused) {
            this.update();
            this.render();
        }

        requestAnimationFrame(this.gameLoop.bind(this));
    }

    update() {
        const dt = this.deltaTime;
        
        if (this.starField) {
            this.starField.update(dt);
        }
        
        if (this.isRunning) {
            this.ball.update();
            this.paddle.update();
        }
        
        if (this.particles) {
            this.particles.update(dt);

			if (document.visibilityState === 'visible') {
				this.particles.render();
			}
        }
        
        this.checkCollisions();
        this.checkWinLose();
        this.checkVictory();
    }

    applyCameraEffects() {
        if (this.camera.shake > 0) {
            this.camera.offsetX = (Math.random() - 0.5) * this.camera.shake;
            this.camera.offsetY = (Math.random() - 0.5) * this.camera.shake;
            this.camera.shake *= 0.9;
        } else {
            this.camera.offsetX = 0;
            this.camera.offsetY = 0;
        }
    }

	render() {
	  // 1. Корректное применение трансформаций камеры
	  this.ctx.save();
	  this.applyCameraEffects();
	  
	  // 2. Очистка всего холста
	  this.ctx.clearRect(
		-this.camera.offsetX, 
		-this.camera.offsetY,
		this.canvas.width + Math.abs(this.camera.offsetX)*2,
		this.canvas.height + Math.abs(this.camera.offsetY)*2
	  );

	  // 3. Фон с расширенной областью
	  this.ctx.fillStyle = '#0A0A20';
	  this.ctx.fillRect(
		-this.camera.offsetX - 100,
		-this.camera.offsetY - 100,
		this.canvas.width + 200,
		this.canvas.height + 200
	  );

	  // 4. Отрисовка звезд с компенсацией смещения
	  this.ctx.save();
	  this.ctx.translate(-this.camera.offsetX, -this.camera.offsetY);
	  this.starField.draw(this.ctx);
	  this.ctx.restore();

	  // 5. Отрисовка игровых объектов
	  this.blocks.render();
	  this.paddle.render();
	  this.ball.render();
	  this.particles.render();

	  // 6. Постобработка с полным покрытием
	  this.postProcessor.applyEffects();

	  this.ctx.restore();
	}

	checkCollisions() {
		let collisionOccurred = false; // Добавляем объявление переменной
		if (this.blocks.blocks.length === 0) return;
		let collisionData = null;

		// Проверка столкновения с платформой
		const now = performance.now();
		let paddleCollision = { hit: false };
		
		if (now > this.ball.lastCollisionTime) {
			paddleCollision = this.ball.checkSweptCollision({
				x: this.paddle.pos.x,
				y: this.paddle.pos.y,
				width: this.paddle.width,
				height: this.paddle.height
			});
			paddleCollision.target = this.paddle; // Перенесено сюда
		}

		if (paddleCollision.hit) {
			this.handlePaddleCollision(paddleCollision);
			collisionOccurred = true;
			collisionData = paddleCollision;
		}

		// Проверка столкновений с блоками
		const blocksToRemove = [];
		this.blocks.blocks.forEach((block, index) => {
			if (block.health <= 0) return;

			const blockCollision = this.ball.checkSweptCollision({
				x: block.x,
				y: block.y,
				width: block.width,
				height: block.height
			});
			blockCollision.target = block; // Добавлено здесь

			if (blockCollision.hit) {
				this.handleBlockCollision(block, index, blockCollision);
				blocksToRemove.push(index);
				collisionOccurred = true;
				collisionData = blockCollision;
			}
		});

		// Применяем коррекцию после всех проверок
		if (collisionOccurred && collisionData) {
			this.ball.applyCollisionCorrection(collisionData);
		}

		// Удаление блоков
		blocksToRemove.reverse().forEach(index => {
			this.blocks.blocks.splice(index, 1);
		});
	}

	handlePaddleCollision(collisionData) {
		const paddleCenter = this.paddle.pos.x + this.paddle.width/2;
		const hitOffset = (this.ball.pos.x - paddleCenter) / (this.paddle.width/2);

		// Новый расчёт угла с учётом зоны удара
		const maxAngle = Math.PI/3;
		const angle = hitOffset * maxAngle;

		// Увеличение скорости
		this.ball.speed *= 1.02;
		this.ball.speed = Math.min(this.ball.speed, 800); // Максимум 800px/s

		// Обновление скорости без нормализации
		this.ball.vel.x = Math.sin(angle) * this.ball.speed;
		this.ball.vel.y = -Math.cos(angle) * this.ball.speed;

		// Эффекты
		this.camera.shake = 5 * Math.abs(hitOffset);
		this.particles.emit(
		  this.ball.pos.x,
		  this.ball.pos.y,
		  {
			type: 'paddleHit', // Добавляем явный тип
			count: 20,
			speed: 150, // Уменьшаем скорость
			size: 3,
			lifetime: 0.8,
			color: '#00f3ff' // Фиксированный цвет
		  }
		);
	  
	  this.soundManager.play('hit', this.ball.speed);
	}

    handleBlockCollision(block, index, collisionData) {
        // Обновленная логика обработки удара по блоку
        block.health--;
        this.score += 100 * this.combo;
        this.combo++;
        this.ball.speed *= 1.01;
        this.camera.shake = 5;

        // Эффекты частиц
        this.particles.emit(
            block.x + block.width/2,
            block.y + block.height/2,
            {
                type: 'blockFragment',
                count: 15,
                speed: 400,
                size: 4,
                lifetime: 0.8,
                color: this.blocks.getBlockColor(block) // Новый метод
            }
        );

        if (block.health <= 0) {
            this.blocks.blocks[index].health = 0;
        }
		
		this.soundManager.play('block-break');
        this.updateScoreDisplay();
    }

    checkWinLose() {
        if (this.ball.pos.y > this.canvas.height + 50) {
            this.loseLife();
        }
    }

	checkVictory() {
		if (this.blocks.blocks.length === 0 && this.isRunning) {
			// Добавить проверку что уровень был загружен
			if (this.blocks.blocksInitialized) {
				this.showVictory();
			}
		}
	}

    showVictory() {
		this.soundManager.play('victory');
        this.isRunning = false;
        alert('Level Completed!');
        this.restartGame();
    }

    loseLife() {
        this.lives--;
        this.updateLivesDisplay();
        this.isRunning = false;
        this.ball.reset();
        this.combo = 1;

        if (this.lives <= 0) {
            setTimeout(() => alert('Game Over!'), 100);
            this.restartGame();
        }
		this.soundManager.play('lose-life');
    }

    updateScoreDisplay() {
        document.getElementById('score').textContent = 
            this.score.toString().padStart(5, '0');
        document.getElementById('combo-counter').textContent = `x${this.combo}`;
        document.getElementById('combo-bar').style.width = 
            `${Math.min(this.combo * 10, 100)}%`;
    }

    updateLivesDisplay() {
        document.getElementById('lives-container').innerHTML = 
            '❤️'.repeat(this.lives);
    }
}

class Ball {
    constructor(game) {
        this.game = game;
        this.radius = 15;
        this.baseSpeed = 400;
        this.reset();
        this.prevPos = { x: 0, y: 0 }; // Добавляем предыдущую позицию
    }

    reset() {
        this.pos = {
            x: this.game.canvas.width / 2,
            y: this.game.canvas.height - 100
        };
        this.prevPos = { ...this.pos };
        this.vel = { x: 0, y: 0 };
        this.speed = this.baseSpeed;
        this.lastCollisionTime = 0;
    }

    checkSweptCollision(target) {
        // Реализация непрерывного обнаружения столкновений
        const movement = {
            x: this.vel.x * this.game.deltaTime,
            y: this.vel.y * this.game.deltaTime
        };

        const expandedRect = {
            x: target.x - this.radius,
            y: target.y - this.radius,
            width: target.width + 2 * this.radius,
            height: target.height + 2 * this.radius
        };

        let tEntry = 0;
        let tExit = 1;

        // Проверка по осям X и Y
        for (let axis = 0; axis < 2; axis++) {
            const axisMin = axis === 0 ? expandedRect.x : expandedRect.y;
            const axisMax = axis === 0 ? 
                expandedRect.x + expandedRect.width : 
                expandedRect.y + expandedRect.height;

            const start = axis === 0 ? this.prevPos.x : this.prevPos.y;
            const end = start + (axis === 0 ? movement.x : movement.y);

            if (axis === 0 ? movement.x === 0 : movement.y === 0) {
                if (start < axisMin || start > axisMax) return { hit: false };
                continue;
            }

            const t0 = (axisMin - start) / (end - start);
            const t1 = (axisMax - start) / (end - start);

            const tMin = Math.min(t0, t1);
            const tMax = Math.max(t0, t1);

            tEntry = Math.max(tEntry, tMin);
            tExit = Math.min(tExit, tMax);

            if (tEntry > tExit) return { hit: false };
        }

		return {
			hit: tEntry < 1 && tEntry >= 0,
			time: tEntry,
			normal: this.calculateCollisionNormal(target, movement, tEntry),
			target: target // Добавляем цель столкновения
		};
    }

	calculateCollisionNormal(target, movement, tEntry) {
		// Для платформы - всегда вертикальный отскок
		if (target === this.game.paddle) {
			return { x: 0, y: -1 };
		}
		
		// Оригинальная логика для других объектов
		const collisionX = this.prevPos.x + movement.x * tEntry;
		const collisionY = this.prevPos.y + movement.y * tEntry;
		
		const toLeft = collisionX - target.x;
		const toRight = (target.x + target.width) - collisionX;
		const toTop = collisionY - target.y;
		const toBottom = (target.y + target.height) - collisionY;
		
		const min = Math.min(toLeft, toRight, toTop, toBottom);
		
		return {
			x: min === toLeft ? -1 : min === toRight ? 1 : 0,
			y: min === toTop ? -1 : min === toBottom ? 1 : 0
		};
	}

	applyCollisionCorrection(collisionData) {
		// Для блоков (проверяем наличие свойства health вместо класса Block)
		if (collisionData.target && collisionData.target.health !== undefined) {
			const speedBefore = Math.sqrt(this.vel.x**2 + this.vel.y**2);
			
			// Отражение вектора скорости
			const dot = this.vel.x * collisionData.normal.x + this.vel.y * collisionData.normal.y;
			this.vel.x -= 2 * dot * collisionData.normal.x;
			this.vel.y -= 2 * dot * collisionData.normal.y;

			// Коррекция скорости
			const speedAfter = Math.sqrt(this.vel.x**2 + this.vel.y**2);
			this.vel.x *= speedBefore / speedAfter;
			this.vel.y *= speedBefore / speedAfter;

			// Коррекция позиции
			this.pos.x += collisionData.normal.x * this.radius * 0.1;
			this.pos.y += collisionData.normal.y * this.radius * 0.1;
		}
		
		// Для платформы коррекция не требуется, так как она обрабатывается отдельно
	}

    resize() {
        this.radius = Math.max(
            this.game.canvas.height * 0.015, 
            12 // Минимальный радиус
        );
    }

    launch() {
        const angle = Math.PI/4 + (Math.random() * Math.PI/8 - Math.PI/16);
        this.vel.x = Math.cos(angle) * this.speed;
        this.vel.y = -Math.sin(angle) * this.speed;
    }

    update() {
        if (!this.game.isRunning) return;

        // Разделение движения на 8 шагов для точности
        const steps = 8;
        const stepDelta = this.game.deltaTime / steps;
        
        for (let i = 0; i < steps; i++) {
            this.prevPos = { ...this.pos };
            
            // Обновление позиции
            this.pos.x += this.vel.x * stepDelta;
            this.pos.y += this.vel.y * stepDelta;

            // Проверка границ
            this.checkBoundaries();
        }
    }

	checkBoundaries() {
		// Левая/правая стенки
		if (this.pos.x <= this.radius || this.pos.x >= this.game.canvas.width - this.radius) {
			this.vel.x *= -1;
			this.pos.x = Math.max(this.radius, Math.min(this.pos.x, this.game.canvas.width - this.radius));
			this.game.soundManager.play('wall-hit');
		}

		// Верхняя стенка
		if (this.pos.y <= this.radius) {
			this.vel.y *= -1;
			this.pos.y = Math.max(this.radius, this.pos.y);
			this.game.soundManager.play('wall-hit');
		}
	}

    render() {
        // Свечение
        const gradient = this.game.ctx.createRadialGradient(
            this.pos.x, this.pos.y, 0,
            this.pos.x, this.pos.y, this.radius * 2
        );
        gradient.addColorStop(0, 'rgba(0, 243, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 243, 255, 0)');

        // Трейл эффект
        this.game.ctx.save();
        this.game.ctx.globalCompositeOperation = 'lighter';
        this.game.ctx.beginPath();
        this.game.ctx.arc(this.pos.x, this.pos.y, this.radius * 2, 0, Math.PI * 2);
        this.game.ctx.fillStyle = gradient;
        this.game.ctx.fill();
        this.game.ctx.restore();

        // Основной шар
        this.game.ctx.beginPath();
        this.game.ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        this.game.ctx.fillStyle = '#00f3ff';
        this.game.ctx.fill();
    }
}

class Paddle {
    constructor(game) {
        this.game = game;
        this.width = 120;
        this.height = 20;
        this.speed = 1200;
        this.reset();
    }

    reset() {
        this.pos = {
            x: this.game.canvas.width/2 - this.width/2,
            y: this.game.canvas.height - 50
        };
    }

    resize() {
        this.width = this.game.canvas.width * 0.15;
        this.height = this.game.canvas.height * 0.025;
        this.reset();
    }

    move(speed) {
        this.pos.x += speed * this.game.deltaTime;
        this.pos.x = Math.max(0, Math.min(
            this.pos.x, 
            this.game.canvas.width - this.width
        ));
    }

    moveTo(pos) {
        const targetX = pos * this.game.canvas.width - this.width/2;
        // Плавное перемещение с интерполяцией
        this.pos.x += (targetX - this.pos.x) * 0.15;
        this.pos.x = Math.max(0, Math.min(
            this.pos.x, 
            this.game.canvas.width - this.width
        ));
    }

    update() {
        this.pos.x = Math.max(0, Math.min(
            this.pos.x, 
            this.game.canvas.width - this.width
        ));
    }

    render() {
        this.game.ctx.fillStyle = '#00f3ff';
        this.game.ctx.fillRect(
            this.pos.x,
            this.pos.y,
            this.width,
            this.height
        );
    }
}

class BlockManager {
    constructor(game) {
        this.game = game;
        this.blocks = [];
        this.colors = {
            basic: ['#ff00ff', '#6a00ff'],
            unbreakable: ['#666', '#999'],
            bonus: ['#00ff00', '#00ffff']
        };
    }

    generateLevel(keepState = false) {
		if (!keepState) {
            // Генерация нового уровня
			this.blocksInitialized = true;
			this.blocks = [];
			const cols = 8;
			const rows = 5;
			const padding = 20;

			const blockWidth = (this.game.canvas.width - (cols + 1) * padding) / cols;
			const blockHeight = 30;

			for (let i = 0; i < cols; i++) {
				for (let j = 0; j < rows; j++) {
					this.blocks.push({
						x: padding + i * (blockWidth + padding),
						y: padding + j * (blockHeight + padding),
						width: blockWidth,
						height: blockHeight,
						type: this.getRandomType(),
						health: 1
					});
				}
			}
		} else {
            // Только обновление позиций существующих блоков
            this.resize();
        }
    }

    getRandomType() {
        const rand = Math.random();
        return rand < 0.6 ? 'basic' : 
               rand < 0.8 ? 'bonus' : 
               'unbreakable';
    }

    checkOverlap(newBlock) {
        return this.blocks.some(block => {
            return !(newBlock.x + newBlock.width < block.x ||
                    newBlock.x > block.x + block.width ||
                    newBlock.y + newBlock.height < block.y ||
                    newBlock.y > block.y + block.height);
        });
    }

    checkCollision(ball) {
        const collision = this.blocks.some(block => {
            if(block.health <= 0) return false;
            
            const closestX = Math.max(block.x, Math.min(ball.pos.x, block.x + block.width));
            const closestY = Math.max(block.y, Math.min(ball.pos.y, block.y + block.height));
            const dx = ball.pos.x - closestX;
            const dy = ball.pos.y - closestY;
            return Math.sqrt(dx*dx + dy*dy) < ball.radius;
        });
        if (this.blocks.length === 0) {
            this.game.checkVictory();
        }
        return collision;
    }

    render() {
        this.blocks.forEach(block => {
            if(block.health <= 0) return;
            
            const gradient = this.createGradient(block);
            this.game.ctx.fillStyle = gradient;
            this.game.ctx.fillRect(block.x, block.y, block.width, block.height);
            
            // Свечение
            this.game.ctx.save();
            this.game.ctx.filter = 'blur(10px)';
            this.game.ctx.globalCompositeOperation = 'lighter';
            this.game.ctx.fillStyle = this.getBlockColor(block);
            this.game.ctx.globalAlpha = 0.3;
            this.game.ctx.fillRect(
                block.x - 5, 
                block.y - 5, 
                block.width + 10, 
                block.height + 10
            );
            this.game.ctx.restore();
        });
    }

    getBlockColor(block) {
        const [c1, c2] = this.colors[block.type];
        return this.mixColors(c1, c2, 0.5); // Смешиваем два цвета блока
    }

    mixColors(color1, color2, weight = 0.5) {
        // Конвертируем hex в RGB
        const parseHex = (hex) => {
            hex = hex.replace(/^#/, '');
            if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
            const num = parseInt(hex, 16);
            return [num >> 16, num >> 8 & 255, num & 255];
        };

        // Парсим цвета
        const rgb1 = parseHex(color1);
        const rgb2 = parseHex(color2);

        // Смешиваем каналы
        const w = Math.max(0, Math.min(1, weight));
        const r = Math.round(rgb1[0] * w + rgb2[0] * (1 - w));
        const g = Math.round(rgb1[1] * w + rgb2[1] * (1 - w));
        const b = Math.round(rgb1[2] * w + rgb2[2] * (1 - w));

        // Конвертируем обратно в HEX
        const toHex = (n) => {
            const hex = n.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    createGradient(block) {
        const gradient = this.game.ctx.createLinearGradient(
            block.x, block.y, 
            block.x + block.width, block.y + block.height
        );
        
        gradient.addColorStop(0, this.colors[block.type][0]);
        gradient.addColorStop(1, this.colors[block.type][1]);
        return gradient;
    }
	
	resize() {
	  const cols = 8;
	  const rows = 5;
	  const padding = 20;
	  const blockWidth = (this.game.canvas.width - (cols + 1)*padding)/cols;
	  const blockHeight = 30;

	  this.blocks.forEach((block, index) => {
		const i = index % cols;
		const j = Math.floor(index / cols);
		block.x = padding + i*(blockWidth + padding);
		block.y = padding + j*(blockHeight + padding);
		block.width = blockWidth;
		block.height = blockHeight;
	  });
	}
	
	hit(block) {
		block.health--;

		// Эффект разрушения
		this.game.particles.emit(
			block.x + block.width / 2,
			block.y + block.height / 2,
			{
				count: 20,
				speed: 300,
				size: 4,
				lifetime: 1,
				color: this.getBlockColor(block) // Pass the block's color
			}
		);

		if (block.health <= 0) {
			this.createPowerUp(block);
			// Удаляем блок из массива
			const index = this.blocks.indexOf(block);
			if (index > -1) {
				this.blocks.splice(index, 1);
			}
		}
	}


    createPowerUp(block) {
        if(block.type === 'bonus') {
            // Логика генерации бонусов
        }
    }
}

class Particle {
    constructor(game) {
        this.game = game;
        this.pos = { x: 0, y: 0 };
        this.vel = { x: 0, y: 0 };
        this.radius = 0;
        this.life = 0;
        this.maxLife = 0;
        this.color = '#FFFFFF';
        this.type = 'circle';
        this.active = false;
    }

    reset(x, y, config) {
        this.pos.x = x;
        this.pos.y = y;
        this.vel.x = (Math.random() - 0.5) * config.speed;
        this.vel.y = (Math.random() - 0.5) * config.speed;
        this.radius = config.size * (0.5 + Math.random() * 0.5);
        this.life = config.lifetime;
        this.maxLife = config.lifetime;
        this.color = config.color;
        this.type = config.type || 'circle';
        this.active = true;
    }

    update(dt) {
        if (!this.active) return;

        // Обновляем физику для всех частиц одинаково
        this.life -= dt;
        this.vel.y += 800 * dt; // Гравитация
        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;
        this.radius *= 0.98;

        // Деактивация при выходе за границы
        if (this.pos.y > this.game.canvas.height + 100) {
            this.active = false;
        }
    }
}

class ParticleSystem {
    constructor(game) {
        this.game = game;
        this.poolSize = 2000;
        this.particles = [];
        this.pool = [];
        this.BATCH_SIZE = 100;

        // Настройки качества
        this.qualitySettings = {
            mobile: {
                maxParticles: 500,
                batchSize: 50
            },
            desktop: {
                maxParticles: 2000,
                batchSize: 100
            }
        };

        // Инициализация пула
        this.initPool();
        this.applyQualitySettings();
    }

    initPool() {
        for (let i = 0; i < this.poolSize; i++) {
            this.pool.push(new Particle(this.game));
        }
    }

    applyQualitySettings() {
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        const settings = isMobile ? this.qualitySettings.mobile : this.qualitySettings.desktop;
        
        this.BATCH_SIZE = settings.batchSize;
        this.poolSize = settings.maxParticles;
    }

    emit(x, y, config) {
        const needed = Math.min(config.count, this.pool.length);
        
        for (let i = 0; i < needed; i++) {
            const particle = this.pool.pop();
            if (particle) {
                particle.reset(x, y, config);
                this.particles.push(particle);
            }
        }
    }

	update(dt) {
	  let i = this.particles.length;
	  while (i--) {
		const p = this.particles[i];
		
		// Добавляем проверку границ
		if (p.pos.y > this.game.canvas.height + 100) {
		  p.active = false;
		}
		
		p.update(dt);
		if (!p.active) {
		  this.pool.push(this.particles.splice(i, 1)[0]);
		}
	  }
	}

    render() {
        const ctx = this.game.ctx;
        let count = 0;
        
        ctx.save();
        ctx.beginPath();
        
        this.particles.forEach((p, i) => {
            if (!p.active) return;

            // Батчинг по типам и цветам
            if (count === 0 || 
                (i % this.BATCH_SIZE === 0 && count > 0)) {
                ctx.fill();
                ctx.beginPath();
                count = 0;
            }

            this.drawParticle(p, ctx);
            count++;
        });

        ctx.fill();
        ctx.restore();
    }

    drawParticle(p, ctx) {
        const alpha = Math.pow(p.life / p.maxLife, 2);
        
        // Возвращаем стили из первого файла для blockFragment
        switch(p.type) {
            case 'blockFragment':
                ctx.save();
                const gradient = ctx.createRadialGradient(
                    p.pos.x, p.pos.y, 0,
                    p.pos.x, p.pos.y, p.radius * 2
                );
                gradient.addColorStop(0, `${p.color}ff`);
                gradient.addColorStop(1, `${p.color}00`);
                
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(p.pos.x, p.pos.y, p.radius * 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                break;

            case 'paddleHit':
                ctx.fillStyle = '#00f3ff';
                ctx.globalAlpha = alpha * 0.8;
                ctx.beginPath();
                ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
                break;

            default:
                ctx.fillStyle = p.color;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
        }
    }

    drawBasic(p, ctx, alpha) {
        ctx.moveTo(p.pos.x + p.radius, p.pos.y);
        ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
    }

    drawGlow(p, ctx, alpha) {
        const gradient = ctx.createRadialGradient(
            p.pos.x, p.pos.y, 0,
            p.pos.x, p.pos.y, p.radius * 2
        );
        gradient.addColorStop(0, `${p.color}${Math.floor(alpha * 255).toString(16)}`);
        gradient.addColorStop(1, `${p.color}00`);
        
        ctx.fillStyle = gradient;
        ctx.moveTo(p.pos.x + p.radius * 2, p.pos.y);
        ctx.arc(p.pos.x, p.pos.y, p.radius * 2, 0, Math.PI * 2);
    }

    drawBlockFragment(p, ctx, alpha) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.7;
        ctx.moveTo(p.pos.x + p.radius, p.pos.y);
        ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
    }
}

// Инициализация игры
const gameCanvas = document.getElementById('game-canvas');
const game = new GameEngine(gameCanvas);
game.resize(); // Принудительный вызов
window.dispatchEvent(new Event('resize')); // Триггер для обработчиков