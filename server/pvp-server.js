// ⚽ SOCCER CAPS PVP SERVER
// Authoritative Server Architecture
// Node.js + Socket.IO + Matter.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Matter = require('matter-js');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ============================================================
// 🎮 КОНФИГУРАЦИЯ ФИЗИКИ (ИЗ КЛИЕНТА)
// ============================================================

const PHYSICS_CONFIG = {
  gravity: { x: 0, y: 0 },
  positionIterations: 10,
  velocityIterations: 8,
  fps: 60,
  delta: 1000 / 60, // 16.67ms
};

const FIELD_CONFIG = {
  WIDTH: 600,
  HEIGHT: 900,
  BORDER_THICKNESS: 20,
  WALL_THICKNESS: 80,
  GOAL_WIDTH: 138,
  GOAL_DEPTH: 40,
  POST_THICKNESS: 12,
};

const BALL_CONFIG = {
  RADIUS: 15,
  MASS: 1.2,
  RESTITUTION: 0.88,
  FRICTION: 0.002,
  FRICTION_AIR: 0.005,
  FRICTION_STATIC: 0.001,
  MAX_SPEED: 28,
  MAX_ANGULAR_VELOCITY: 0.35,
  SLOP: 0.01,
};

const UNIT_CLASSES = {
  balanced: {
    radius: 36,
    mass: 3.5,
    restitution: 0.7,
    friction: 0.05,
    frictionAir: 0.02,
    frictionStatic: 0.1,
    forceMultiplier: 0.0020,
    maxForce: 0.26,
    maxSpeed: 26,
  },
  tank: {
    radius: 36 * 1.1,
    mass: 6.0,
    restitution: 0.2,
    friction: 0.2,
    frictionAir: 0.05,
    frictionStatic: 0.1,
    forceMultiplier: 0.0017,
    maxForce: 0.20,
    maxSpeed: 19,
  },
  sniper: {
    radius: 36,
    mass: 2.8,
    restitution: 0.42,
    friction: 0.02,
    frictionAir: 0.012,
    frictionStatic: 0.08,
    forceMultiplier: 0.0023,
    maxForce: 0.28,
    maxSpeed: 34,
  },
  trickster: {
    radius: 36,
    mass: 3.0,
    restitution: 0.9,
    friction: 0.04,
    frictionAir: 0.015,
    frictionStatic: 0.06,
    forceMultiplier: 0.0019,
    maxForce: 0.24,
    maxSpeed: 30,
  },
};

const WALL_RESTITUTION = {
  SIDE: 0.75,
  END: 0.70,
  CORNER: 0.50,
  POST: 0.92,
};

const GAME_CONFIG = {
  VELOCITY_THRESHOLD: 0.1,
  TIME_LIMIT: 300, // 5 минут
  RECONNECT_TIMEOUT: 30000, // 30 секунд
  STATE_UPDATE_INTERVAL: 3, // Каждые 3 кадра (50ms)
  MAX_GOALS: 5, // Первый до 5 голов
};

// ============================================================
// 🏟️ КЛАСС ФИЗИЧЕСКОГО МИРА
// ============================================================

class PhysicsWorld {
  constructor(roomId) {
    this.roomId = roomId;
    this.engine = Matter.Engine.create({
      gravity: PHYSICS_CONFIG.gravity,
      positionIterations: PHYSICS_CONFIG.positionIterations,
      velocityIterations: PHYSICS_CONFIG.velocityIterations,
    });

    this.world = this.engine.world;
    this.fieldScale = 1.0; // Можно масштабировать под разные экраны
    this.fieldBounds = this.calculateFieldBounds();
    
    this.ball = null;
    this.units = new Map(); // unitId -> body
    this.walls = [];
    
    this.createWorld();
  }

  calculateFieldBounds() {
    const width = FIELD_CONFIG.WIDTH * this.fieldScale;
    const height = FIELD_CONFIG.HEIGHT * this.fieldScale;
    const padding = FIELD_CONFIG.BORDER_THICKNESS * this.fieldScale;
    
    return {
      left: padding,
      right: width - padding,
      top: padding,
      bottom: height - padding,
      centerX: width / 2,
      centerY: height / 2,
      width: width - padding * 2,
      height: height - padding * 2,
    };
  }

  createWorld() {
    this.createWalls();
    this.createGoalSensors();
    this.createBall();
  }

  createWalls() {
    const bounds = this.fieldBounds;
    const thickness = FIELD_CONFIG.WALL_THICKNESS * this.fieldScale;
    const goalWidth = FIELD_CONFIG.GOAL_WIDTH * this.fieldScale;
    const goalHalfWidth = goalWidth / 2;

    // Верхняя стена (с проёмом для ворот)
    this.walls.push(
      Matter.Bodies.rectangle(
        bounds.left + (bounds.centerX - goalHalfWidth) / 2,
        bounds.top - thickness / 2,
        bounds.centerX - goalHalfWidth - bounds.left,
        thickness,
        { isStatic: true, label: 'wall_top_left', restitution: WALL_RESTITUTION.END }
      ),
      Matter.Bodies.rectangle(
        bounds.centerX + goalHalfWidth + (bounds.right - bounds.centerX - goalHalfWidth) / 2,
        bounds.top - thickness / 2,
        bounds.right - bounds.centerX - goalHalfWidth,
        thickness,
        { isStatic: true, label: 'wall_top_right', restitution: WALL_RESTITUTION.END }
      )
    );

    // Нижняя стена (с проёмом для ворот)
    this.walls.push(
      Matter.Bodies.rectangle(
        bounds.left + (bounds.centerX - goalHalfWidth) / 2,
        bounds.bottom + thickness / 2,
        bounds.centerX - goalHalfWidth - bounds.left,
        thickness,
        { isStatic: true, label: 'wall_bottom_left', restitution: WALL_RESTITUTION.END }
      ),
      Matter.Bodies.rectangle(
        bounds.centerX + goalHalfWidth + (bounds.right - bounds.centerX - goalHalfWidth) / 2,
        bounds.bottom + thickness / 2,
        bounds.right - bounds.centerX - goalHalfWidth,
        thickness,
        { isStatic: true, label: 'wall_bottom_right', restitution: WALL_RESTITUTION.END }
      )
    );

    // Боковые стены
    this.walls.push(
      Matter.Bodies.rectangle(
        bounds.left - thickness / 2,
        bounds.centerY,
        thickness,
        bounds.height + thickness * 2,
        { isStatic: true, label: 'wall_left', restitution: WALL_RESTITUTION.SIDE }
      ),
      Matter.Bodies.rectangle(
        bounds.right + thickness / 2,
        bounds.centerY,
        thickness,
        bounds.height + thickness * 2,
        { isStatic: true, label: 'wall_right', restitution: WALL_RESTITUTION.SIDE }
      )
    );

    // Штанги ворот
    const postThickness = FIELD_CONFIG.POST_THICKNESS * this.fieldScale;
    this.walls.push(
      // Верхние ворота
      Matter.Bodies.rectangle(
        bounds.centerX - goalHalfWidth,
        bounds.top,
        postThickness,
        postThickness * 2,
        { isStatic: true, label: 'post_top_left', restitution: WALL_RESTITUTION.POST }
      ),
      Matter.Bodies.rectangle(
        bounds.centerX + goalHalfWidth,
        bounds.top,
        postThickness,
        postThickness * 2,
        { isStatic: true, label: 'post_top_right', restitution: WALL_RESTITUTION.POST }
      ),
      // Нижние ворота
      Matter.Bodies.rectangle(
        bounds.centerX - goalHalfWidth,
        bounds.bottom,
        postThickness,
        postThickness * 2,
        { isStatic: true, label: 'post_bottom_left', restitution: WALL_RESTITUTION.POST }
      ),
      Matter.Bodies.rectangle(
        bounds.centerX + goalHalfWidth,
        bounds.bottom,
        postThickness,
        postThickness * 2,
        { isStatic: true, label: 'post_bottom_right', restitution: WALL_RESTITUTION.POST }
      )
    );

    Matter.World.add(this.world, this.walls);
  }

  createGoalSensors() {
    const bounds = this.fieldBounds;
    const goalWidth = FIELD_CONFIG.GOAL_WIDTH * this.fieldScale;
    const goalDepth = FIELD_CONFIG.GOAL_DEPTH * this.fieldScale;

    this.topGoalSensor = Matter.Bodies.rectangle(
      bounds.centerX,
      bounds.top - goalDepth / 2,
      goalWidth,
      goalDepth,
      { 
        isStatic: true, 
        isSensor: true, 
        label: 'goal_top',
      }
    );

    this.bottomGoalSensor = Matter.Bodies.rectangle(
      bounds.centerX,
      bounds.bottom + goalDepth / 2,
      goalWidth,
      goalDepth,
      { 
        isStatic: true, 
        isSensor: true, 
        label: 'goal_bottom',
      }
    );

    Matter.World.add(this.world, [this.topGoalSensor, this.bottomGoalSensor]);
  }

  createBall() {
    const bounds = this.fieldBounds;
    const radius = BALL_CONFIG.RADIUS * this.fieldScale;

    this.ball = Matter.Bodies.circle(
      bounds.centerX,
      bounds.centerY,
      radius,
      {
        mass: BALL_CONFIG.MASS,
        restitution: BALL_CONFIG.RESTITUTION,
        friction: BALL_CONFIG.FRICTION,
        frictionAir: BALL_CONFIG.FRICTION_AIR,
        frictionStatic: BALL_CONFIG.FRICTION_STATIC,
        slop: BALL_CONFIG.SLOP,
        label: 'ball',
      }
    );

    Matter.World.add(this.world, this.ball);
  }

  createUnit(unitId, x, y, capClass, owner) {
    const config = UNIT_CLASSES[capClass] || UNIT_CLASSES.balanced;
    const radius = config.radius * this.fieldScale;

    const body = Matter.Bodies.circle(x, y, radius, {
      mass: config.mass,
      restitution: config.restitution,
      friction: config.friction,
      frictionAir: config.frictionAir,
      frictionStatic: config.frictionStatic,
      inertia: Infinity, // Предотвращает вращение
      label: `unit_${owner}_${capClass}`,
    });

    body.unitId = unitId;
    body.owner = owner;
    body.capClass = capClass;
    body.maxSpeed = config.maxSpeed;

    this.units.set(unitId, body);
    Matter.World.add(this.world, body);

    return body;
  }

  applyForce(unitId, forceX, forceY) {
    const body = this.units.get(unitId);
    if (!body) return false;

    Matter.Body.applyForce(body, body.position, { x: forceX, y: forceY });
    return true;
  }

  step() {
    // Фиксированный timestep
    Matter.Engine.update(this.engine, PHYSICS_CONFIG.delta);

    // Ограничение скорости мяча
    this.limitBallSpeed();

    // Ограничение скорости юнитов
    this.limitUnitSpeeds();

    // Проверка границ поля
    this.checkBoundaries();
  }

  limitBallSpeed() {
    if (!this.ball) return;

    const vel = this.ball.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

    if (speed > BALL_CONFIG.MAX_SPEED) {
      const factor = BALL_CONFIG.MAX_SPEED / speed;
      Matter.Body.setVelocity(this.ball, {
        x: vel.x * factor,
        y: vel.y * factor,
      });
    }

    // Ограничение угловой скорости
    if (Math.abs(this.ball.angularVelocity) > BALL_CONFIG.MAX_ANGULAR_VELOCITY) {
      Matter.Body.setAngularVelocity(
        this.ball,
        Math.sign(this.ball.angularVelocity) * BALL_CONFIG.MAX_ANGULAR_VELOCITY
      );
    }
  }

  limitUnitSpeeds() {
    for (const [unitId, body] of this.units) {
      const vel = body.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      const maxSpeed = body.maxSpeed || 26;

      if (speed > maxSpeed) {
        const factor = maxSpeed / speed;
        Matter.Body.setVelocity(body, {
          x: vel.x * factor,
          y: vel.y * factor,
        });
      }
    }
  }

  checkBoundaries() {
    // Проверка мяча
    if (this.ball) {
      const pos = this.ball.position;
      const r = BALL_CONFIG.RADIUS * this.fieldScale;
      const bounds = this.fieldBounds;
      const margin = 80;

      if (
        pos.x < bounds.left - margin ||
        pos.x > bounds.right + margin ||
        pos.y < bounds.top - margin ||
        pos.y > bounds.bottom + margin
      ) {
        // Возвращаем мяч в центр
        Matter.Body.setPosition(this.ball, { x: bounds.centerX, y: bounds.centerY });
        Matter.Body.setVelocity(this.ball, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(this.ball, 0);
      }
    }
  }

  isEverythingStopped() {
    // Проверка мяча
    if (this.ball) {
      const ballSpeed = Math.sqrt(
        this.ball.velocity.x ** 2 + this.ball.velocity.y ** 2
      );
      if (ballSpeed > GAME_CONFIG.VELOCITY_THRESHOLD) return false;
    }

    // Проверка юнитов
    for (const [unitId, body] of this.units) {
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
      if (speed > GAME_CONFIG.VELOCITY_THRESHOLD) return false;
    }

    return true;
  }

  getState() {
    const state = {
      ball: this.ball ? {
        x: this.ball.position.x,
        y: this.ball.position.y,
        vx: this.ball.velocity.x,
        vy: this.ball.velocity.y,
        angle: this.ball.angle,
        angularVelocity: this.ball.angularVelocity,
      } : null,
      units: {},
    };

    for (const [unitId, body] of this.units) {
      state.units[unitId] = {
        x: body.position.x,
        y: body.position.y,
        vx: body.velocity.x,
        vy: body.velocity.y,
        angle: body.angle,
      };
    }

    return state;
  }

  resetBall() {
    if (this.ball) {
      const bounds = this.fieldBounds;
      Matter.Body.setPosition(this.ball, { x: bounds.centerX, y: bounds.centerY });
      Matter.Body.setVelocity(this.ball, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(this.ball, 0);
    }
  }

  destroy() {
    Matter.Engine.clear(this.engine);
    Matter.World.clear(this.world, false);
  }
}

// ============================================================
// 🎮 КЛАСС ИГРОВОЙ КОМНАТЫ
// ============================================================

class GameRoom {
  constructor(roomId, player1, player2) {
    this.roomId = roomId;
    this.players = {
      [player1.id]: { ...player1, team: 1, ready: false, connected: true },
      [player2.id]: { ...player2, team: 2, ready: !!player2.isBot, connected: true },
    };

    this.physics = new PhysicsWorld(roomId);
    this.state = 'waiting'; // waiting, ready, playing, paused, finished
    this.currentTeam = 1;
    this.turnNumber = 0;
    this.scores = { 1: 0, 2: 0 };
    this.startTime = null;
    this.timeLimit = GAME_CONFIG.TIME_LIMIT;
    
    this.frameCount = 0;
    this.simulationInterval = null;
    this.isSimulating = false;

    console.log(`[Room ${roomId}] Created: ${player1.id} vs ${player2.id}`);
  }

  addPlayer(playerId, playerData) {
    this.players[playerId] = { ...playerData, ready: false, connected: true };
  }

  setReady(playerId) {
    if (this.players[playerId]) {
      this.players[playerId].ready = true;
    }

    // Если оба готовы - начинаем игру
    if (Object.values(this.players).every(p => p.ready)) {
      this.startMatch();
    }
  }

  startMatch() {
    this.state = 'playing';
    this.startTime = Date.now();
    this.currentTeam = 1;
    this.turnNumber = 1;

    // Создаём юниты для обеих команд
    this.spawnUnits();

    console.log(`[Room ${this.roomId}] Match STARTED`);

    // Отправляем начальное состояние
    const initialState = this.physics.getState();
    this.broadcast('match:start', {
      initialState,
      yourTeam: null, // Будет заполнено индивидуально
      timeLimit: this.timeLimit,
      currentTeam: this.currentTeam,
    });
  }

  spawnUnits() {
    const bounds = this.physics.fieldBounds;
    
    // Команда 1 (внизу)
    const team1Positions = [
      { x: bounds.centerX, y: bounds.centerY + bounds.height * 0.25, capClass: 'sniper' },
      { x: bounds.centerX - 80, y: bounds.bottom - 80, capClass: 'balanced' },
      { x: bounds.centerX + 80, y: bounds.bottom - 80, capClass: 'tank' },
    ];

    // Команда 2 (вверху)
    const team2Positions = [
      { x: bounds.centerX, y: bounds.centerY - bounds.height * 0.25, capClass: 'sniper' },
      { x: bounds.centerX - 80, y: bounds.top + 80, capClass: 'balanced' },
      { x: bounds.centerX + 80, y: bounds.top + 80, capClass: 'tank' },
    ];

    // Создаём юниты
    team1Positions.forEach((pos, i) => {
      const unitId = `team1_unit${i}`;
      this.physics.createUnit(unitId, pos.x, pos.y, pos.capClass, 1);
    });

    team2Positions.forEach((pos, i) => {
      const unitId = `team2_unit${i}`;
      this.physics.createUnit(unitId, pos.x, pos.y, pos.capClass, 2);
    });
  }

  handleShot(playerId, data) {
    const player = this.players[playerId];
    if (!player) return;

    // Валидация
    if (this.state !== 'playing') {
      console.log(`[Room ${this.roomId}] Shot rejected: game not playing`);
      return;
    }
    
    if (player.team !== this.currentTeam) {
      console.log(`[Room ${this.roomId}] Shot rejected: not player's turn`);
      return;
    }
    
    // Применяем силу
    const { unitId, velocityX, velocityY } = data;
    const success = this.physics.applyForce(unitId, velocityX, velocityY);

    if (!success) {
      console.log(`[Room ${this.roomId}] Shot rejected: invalid unit`);
        return;
      }
      
    console.log(`[Room ${this.roomId}] Shot applied: ${unitId} by team ${player.team}`);

    // Начинаем симуляцию
    this.startSimulation();
  }

  startSimulation() {
    if (this.isSimulating) return;

    this.isSimulating = true;
    this.frameCount = 0;

    this.simulationInterval = setInterval(() => {
      this.physics.step();
      this.frameCount++;

      // Проверка голов
      this.checkGoals();

      // Отправляем состояние каждые N кадров
      if (this.frameCount % GAME_CONFIG.STATE_UPDATE_INTERVAL === 0) {
        const state = this.physics.getState();
        this.broadcast('game:stateUpdate', {
          state,
          frame: this.frameCount,
          timestamp: Date.now(),
        });
      }

      // Проверка остановки
      if (this.physics.isEverythingStopped()) {
        this.stopSimulation();
      }

      // Защита от бесконечной симуляции (10 секунд)
      if (this.frameCount > 600) {
        console.log(`[Room ${this.roomId}] Simulation timeout`);
        this.stopSimulation();
      }
    }, PHYSICS_CONFIG.delta);
  }

  stopSimulation() {
    if (!this.isSimulating) return;

    clearInterval(this.simulationInterval);
    this.isSimulating = false;

    console.log(`[Room ${this.roomId}] Simulation stopped after ${this.frameCount} frames`);

    // Передаём ход другой команде
    this.currentTeam = this.currentTeam === 1 ? 2 : 1;
    this.turnNumber++;

    this.broadcast('game:turnChange', {
      currentTeam: this.currentTeam,
      turnNumber: this.turnNumber,
    });
  }

  checkGoals() {
    if (!this.physics.ball) return;

    const ballPos = this.physics.ball.position;

    // Проверка сенсоров ворот (упрощённая)
    const topGoal = this.physics.topGoalSensor;
    const bottomGoal = this.physics.bottomGoalSensor;

    if (this.isInGoal(ballPos, topGoal)) {
      this.handleGoal(1); // Команда 1 забила в верхние ворота
    } else if (this.isInGoal(ballPos, bottomGoal)) {
      this.handleGoal(2); // Команда 2 забила в нижние ворота
    }
  }

  isInGoal(pos, goalSensor) {
    const b = goalSensor.bounds;
    return pos.x >= b.min.x && pos.x <= b.max.x && 
           pos.y >= b.min.y && pos.y <= b.max.y;
  }

  handleGoal(scoringTeam) {
    this.scores[scoringTeam]++;

    console.log(`[Room ${this.roomId}] GOAL! Team ${scoringTeam}. Score: ${this.scores[1]}-${this.scores[2]}`);

    this.broadcast('game:goal', {
      scoringTeam,
      scores: this.scores,
    });

    // Остановка симуляции
    this.stopSimulation();

    // Проверка победы
    if (this.scores[scoringTeam] >= GAME_CONFIG.MAX_GOALS) {
      this.endMatch(scoringTeam);
    } else {
      // Сброс мяча
        setTimeout(() => {
        this.physics.resetBall();
        this.currentTeam = scoringTeam === 1 ? 2 : 1; // Ход противнику
        this.broadcast('game:turnChange', {
          currentTeam: this.currentTeam,
          turnNumber: ++this.turnNumber,
        });
      }, 2000);
    }
  }

  endMatch(winner) {
    this.state = 'finished';

    console.log(`[Room ${this.roomId}] Match ENDED. Winner: Team ${winner}`);

    this.broadcast('match:end', {
      winner,
      scores: this.scores,
      reason: 'max_goals',
    });

    // Очистка через 5 секунд
    setTimeout(() => {
      this.destroy();
    }, 5000);
  }

  handleDisconnect(playerId) {
    const player = this.players[playerId];
    if (!player) return;

    player.connected = false;

    console.log(`[Room ${this.roomId}] Player ${playerId} disconnected`);

    // Уведомляем противника
    this.broadcast('opponent:disconnected', {
      reconnectTimeout: GAME_CONFIG.RECONNECT_TIMEOUT,
    }, playerId);

    // Таймер на реконнект
    setTimeout(() => {
      if (!player.connected) {
        // Противник победил
        const opponentTeam = player.team === 1 ? 2 : 1;
        this.endMatch(opponentTeam);
      }
    }, GAME_CONFIG.RECONNECT_TIMEOUT);
  }

  handleReconnect(playerId) {
    const player = this.players[playerId];
    if (!player) return;

    player.connected = true;

    console.log(`[Room ${this.roomId}] Player ${playerId} reconnected`);

    this.broadcast('opponent:reconnected', {}, playerId);

    // Отправляем полное состояние
    return {
      state: this.physics.getState(),
      currentTeam: this.currentTeam,
      turnNumber: this.turnNumber,
      scores: this.scores,
      timeRemaining: this.getTimeRemaining(),
    };
  }

  getTimeRemaining() {
    if (!this.startTime) return this.timeLimit;
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    return Math.max(0, this.timeLimit - elapsed);
  }

  broadcast(event, data, excludePlayerId = null) {
    const aliases = {
      'match:start': 'match_start',
      'match:end': 'match_end',
      'game:stateUpdate': 'state_update',
      'game:turnChange': 'turn_change',
      'game:goal': 'goal_scored',
      'game:paused': 'game_paused',
      'opponent:disconnected': 'opponent_disconnected',
      'opponent:reconnected': 'opponent_reconnected',
    };

    for (const playerId in this.players) {
      if (playerId === excludePlayerId) continue;
      const player = this.players[playerId];
      if (player.socket) {
        player.socket.emit(event, data);
        if (aliases[event]) {
          player.socket.emit(aliases[event], data);
        }
      }
    }
  }

  destroy() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
    this.physics.destroy();
    rooms.delete(this.roomId);
    console.log(`[Room ${this.roomId}] Destroyed`);
  }
}

// ============================================================
// 📊 ХРАНИЛИЩЕ
// ============================================================

const rooms = new Map(); // roomId -> GameRoom
const playerToRoom = new Map(); // playerId -> roomId
const matchmakingQueue = []; // Очередь игроков
const BOT_FIRST = ['Neon', 'Cyber', 'Quantum', 'Stellar', 'Nova', 'Orbit', 'Galaxy', 'Void', 'Plasma', 'Shadow', 'Astro', 'Lunar', 'Rocket', 'Ion', 'Pulsar'];
const BOT_SECOND = ['Strike', 'Blade', 'Walker', 'Flux', 'Prime', 'Titan', 'Edge', 'Runner', 'King', 'Ace', 'Legend', 'Hunter', 'Warden', 'Drift'];

function generateBotDisplayName() {
  const a = BOT_FIRST[Math.floor(Math.random() * BOT_FIRST.length)];
  const b = BOT_SECOND[Math.floor(Math.random() * BOT_SECOND.length)];
  const n = Math.floor(Math.random() * 900) + 100;
  return `${a}${b}#${n}`;
}

// ============================================================
// 🔍 MATCHMAKING
// ============================================================

function addToMatchmaking(playerId, playerData, socket) {
  matchmakingQueue.push({ playerId, playerData, socket, mmr: playerData.mmr || 1000 });
  console.log(`[Matchmaking] Player ${playerId} joined queue (${matchmakingQueue.length} players)`);

  // Пробуем найти матч
  tryMatchmaking();
}

function createBotPlayerData(humanPlayer) {
  const name = generateBotDisplayName();
  const factions = ['magma', 'cyborg', 'void', 'insect'];
  const humanFaction = humanPlayer.playerData.factionId;
  const factionId = factions.filter((f) => f !== humanFaction)[Math.floor(Math.random() * Math.max(1, factions.length - 1))] || 'magma';

  return {
    id: `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name,
    playerName: name,
    isBot: true,
    mmr: humanPlayer.mmr,
    factionId,
    teamSize: 3,
    socket: null,
  };
}

function removeFromMatchmaking(playerId) {
  const index = matchmakingQueue.findIndex(p => p.playerId === playerId);
  if (index !== -1) {
    matchmakingQueue.splice(index, 1);
    console.log(`[Matchmaking] Player ${playerId} left queue`);
  }
}

function tryMatchmaking() {
  if (matchmakingQueue.length < 2) {
    const waitingPlayer = matchmakingQueue[0];
    const mode = waitingPlayer?.playerData?.mode;
    if ((mode === 'casual' || mode === 'ranked') && waitingPlayer && !waitingPlayer.botTimer) {
      waitingPlayer.botTimer = setTimeout(() => {
        const index = matchmakingQueue.findIndex(p => p.playerId === waitingPlayer.playerId);
        if (index === -1) return;

        matchmakingQueue.splice(index, 1);
        createMatch(waitingPlayer, {
          playerId: `bot_${Date.now()}`,
          playerData: createBotPlayerData(waitingPlayer),
          socket: null,
          mmr: waitingPlayer.mmr,
        });
      }, 6500);
    }
    return;
  }

  // Простой матчмейкинг: берём первых двух
  const player1 = matchmakingQueue.shift();
  const player2 = matchmakingQueue.shift();

  createMatch(player1, player2);
}

function createMatch(player1, player2) {
  if (player1.botTimer) clearTimeout(player1.botTimer);
  if (player2.botTimer) clearTimeout(player2.botTimer);

  const roomId = uuidv4();

  // Создаём комнату
  const room = new GameRoom(
    roomId,
    { id: player1.playerId, ...player1.playerData, socket: player1.socket },
    { id: player2.playerId, ...player2.playerData, socket: player2.socket }
  );

  rooms.set(roomId, room);
  playerToRoom.set(player1.playerId, roomId);
  playerToRoom.set(player2.playerId, roomId);

  const factionOr = (p) => (p.playerData?.factionId && ['magma', 'cyborg', 'void', 'insect'].includes(p.playerData.factionId))
    ? p.playerData.factionId
    : 'magma';

  const p2Bot = !player2.socket;

  player1.socket.emit('match_found', {
    roomId,
    opponentId: player2.playerId,
    opponentName: player2.playerData.playerName || player2.playerData.name || 'Игрок',
    yourTeam: 1,
    isBotOpponent: p2Bot,
    opponentFactionId: factionOr(player2),
  });

  if (player2.socket) {
    const p1Bot = !player1.socket;
    player2.socket.emit('match_found', {
      roomId,
      opponentId: player1.playerId,
      opponentName: player1.playerData.playerName || player1.playerData.name || 'Игрок',
      yourTeam: 2,
      isBotOpponent: p1Bot,
      opponentFactionId: factionOr(player1),
    });
  }

  console.log(`[Matchmaking] Match created: ${roomId}`);
}

// ============================================================
// 🌐 SOCKET.IO HANDLERS
// ============================================================

io.on('connection', (socket) => {
  console.log(`[Server] Client connected: ${socket.id}`);

  // === MATCHMAKING ===

  socket.on('matchmaking:join', (data) => {
    const { playerId, mmr, teamSetup, playerData = {} } = data;
    addToMatchmaking(playerId || socket.id, {
      ...playerData,
      mode: data.mode,
      mmr,
      teamSetup,
      playerName: data.playerName || playerData.playerName,
      factionId: data.factionId || playerData.factionId,
      teamUnitIds: data.teamUnitIds || playerData.teamUnitIds,
      teamSize: data.teamSize || playerData.teamSize,
    }, socket);
  });

  socket.on('matchmaking:cancel', () => {
    const playerId = socket.id;
    removeFromMatchmaking(playerId);
  });

  // === GAME ===

  socket.on('match:ready', (data) => {
    const { roomId } = data;
    const room = rooms.get(roomId);
    if (!room) return;

    room.setReady(socket.id);
  });

  socket.on('game:shoot', (data) => {
    const roomId = playerToRoom.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;

    room.handleShot(socket.id, data);
  });

  socket.on('game:pause', (data) => {
    const roomId = playerToRoom.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;

    room.state = 'paused';
    room.broadcast('game:paused', {});
  });

  socket.on('game:surrender', () => {
    const roomId = playerToRoom.get(socket.id);
    const room = rooms.get(roomId);
    if (!room) return;

    const player = Object.values(room.players).find(p => p.id === socket.id);
    if (player) {
      const opponentTeam = player.team === 1 ? 2 : 1;
      room.endMatch(opponentTeam);
    }
  });

  // === DISCONNECT ===

  socket.on('disconnect', () => {
    console.log(`[Server] Client disconnected: ${socket.id}`);

    // Удаляем из матчмейкинга
    removeFromMatchmaking(socket.id);

    // Обрабатываем отключение в комнате
    const roomId = playerToRoom.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.handleDisconnect(socket.id);
      }
    }
  });
});

// ============================================================
// 🚀 ЗАПУСК СЕРВЕРА
// ============================================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║          ⚽ SOCCER CAPS PVP SERVER STARTED ⚽          ║
║                                                        ║
║  Port: ${PORT}                                         ║
║  Physics: Matter.js (60 FPS)                          ║
║  Architecture: Authoritative Server                   ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Closing server...');
  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

// Обработка ошибок
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});
