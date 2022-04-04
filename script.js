Array.prototype.shuffle = function() {
    return this.map(value => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value)
}

Array.prototype.getRandomElement = function() {
    return this[Math.floor(Math.random()*this.length)];
}

Array.prototype.getRandomIndex = function() {
    return Math.floor(Math.random()*this.length);
}

const ss = new Image();
ss.onload = () => {
    spawns = generateInitialLastSpawns();
    setScale(false);
    drawAll();
    gameLoop();
}

const SPRITE_SIZE = 16;

let innerWidth = window.innerWidth;
let innerHeight = window.innerHeight;

ss.src = 'img/spritesheet.png';

let offscreenCanvas = document.createElement('canvas');
offscreenCanvas.width = 3 * SPRITE_SIZE;
offscreenCanvas.height = 3 * SPRITE_SIZE;
let offscreenCtx = offscreenCanvas.getContext("2d");
offscreenCtx.imageSmoothingEnabled = false;

let shiftCanvas = document.createElement('canvas');
shiftCanvas.width = offscreenCanvas.width;
shiftCanvas.height = offscreenCanvas.height;
let shiftCtx = shiftCanvas.getContext("2d");
shiftCtx.imageSmoothingEnabled = false;

// DEBUG CANVAS
// document.body.appendChild(offscreenCanvas);
// offscreenCanvas.style.position = 'fixed';
// offscreenCanvas.style.top = '10px';
// offscreenCanvas.style.right = '10px';
// offscreenCanvas.style.border = '1px solid black';

const canvas = document.getElementById('canvas');
canvas.width = innerWidth;
canvas.height = innerHeight;

const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const destroyMap = {
    1: 2,
    4: 5,
    7: 8,
    10: 11,
    // 13: 14,
    // 16: 17
}
const regrowMap = {
    2: {tile: 3, timeout: 5000},
    3: {tile: 4, timeout: 4500},
    5: {tile: 6, timeout: 4000},
    6: {tile: 7, timeout: 3500},
    8: {tile: 9, timeout: 3000},
    9: {tile: 10, timeout: 2500},
    11: {tile: 15, timeout: 2000},
    // 12: {tile: 13, timeout: 5000},
    // 14: {tile: 15, timeout: 5000},
    15: {tile: 16, timeout: 1500},
    16: {tile: 17, timeout: 1000}
}

let spawns = [];

const map = [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1]
];
const lava = [];

let currentStage = 0;

const stages = [
    {entitySpawnBatches: 1, entitiesPerSpawn: 2, threshold: 0},
    {entitySpawnBatches: 1, entitiesPerSpawn: 2, threshold: 50, lava: true}, // 150
    {entitySpawnBatches: 2, entitiesPerSpawn: 2, threshold: 200},
    {entitySpawnBatches: 3, entitiesPerSpawn: 2, threshold: 300}
];

let origin = {x: 1, y: 1};
let scale = 1;
let tween = {scale: null};
let margin = {x: 0, y: 0};
let extraMargin = {x: 0, y: 0};
let entitiesSpawned = 0;
let gameOver = false;
let showInstructions = 10;

let lastSpawn = Date.now();
let spawnCooldown = 1000;
let entitySpawnBatches = 1;
let entitiesPerSpawn = 2; // SHOULD BE 2
let warningShown = true;
let lastWarningToggle = Date.now();
let lastSpawnCooldownReduction = Date.now();
let destroying = false;

const handleDestroy = e => {
    let rect = e.target.getBoundingClientRect();
    let clientX = e.clientX || e.touches[0].clientX;
    let clientY = e.clientY || e.touches[0].clientY;
    let x = clientX - rect.left;
    let y = clientY - rect.top;
    destroy(x, y);
}

const handleDown = e => {
    handleDestroy(e);
    destroying = true;
}

const handleUp = e => {
    destroying = false;
}

const handleMove = e => {
    if (destroying) {
        handleDestroy(e);
    }
}

document.getElementById('instructions').addEventListener('click', () => {
    showInstructions = 0;
    document.getElementById('instructions').remove();
});

canvas.addEventListener('mousedown', handleDown);
canvas.addEventListener('mouseup', handleUp);
canvas.addEventListener('mousemove', handleMove);

canvas.addEventListener('touchstart', handleDown);
canvas.addEventListener('touchend', handleUp);
canvas.addEventListener('touchmove', handleMove);

const gameLoop = () => {
    if (gameOver) return;

    let now = Date.now();
    if (lava.length < 500 && now - lastSpawn > spawnCooldown) {
        lastSpawn = Date.now();
        for (let i = 0; i < entitySpawnBatches; i++) {
            increaseEntities(entitiesPerSpawn);
        }
    }

    if (now - lastSpawnCooldownReduction > 1000) {
        lastSpawnCooldownReduction = now;
        spawnCooldown = spawnCooldown * 0.995;
    }

    // Reverse for loop
    
    for (let i = lava.length - 1; i >= 0; i--) {
        let remove = updateLava(lava[i], now);
        if (remove) {
            lava.splice(i, 1);
        }
    }

    let scalePointer = Math.max(map[0].length, map.length) - 3;

    if (currentStage === 0) {
        let warningToggleCooldown = 100 + (2000 - (1900 * (scalePointer / stages[1].threshold)));
        if (warningToggleCooldown < 500) warningToggleCooldown = 100;
        if (now - lastWarningToggle > warningToggleCooldown) {
            lastWarningToggle = now;
            warningShown = !warningShown;
            drawTile(origin.x, origin.y, map[origin.y][origin.x]);
        }
    }

    let nextStage = stages[currentStage + 1];
    if (nextStage) {
        if (scalePointer >= nextStage.threshold) {
            currentStage++;
            entitySpawnBatches = nextStage.entitySpawnBatches;
            entitiesPerSpawn = nextStage.entitiesPerSpawn;
            if (nextStage.lava) {
                lava.push({x: 0, y: 0, lastSpread: Date.now(), state: 3, timeout: 7500});
                map[origin.y][origin.x] = 18;
                drawTile(origin.x, origin.y, 18);
            }
        }
    }

    let mW = (map[0].length + Math.abs(extraMargin.x)) * SPRITE_SIZE * scale;
    let mH = (map.length + Math.abs(extraMargin.y)) * SPRITE_SIZE * scale;

    if (innerWidth > mW && innerHeight > mH) {
        if (Math.max(map[0].length, map.length) < 10) {
            scale = scale * 0.999;
        } else {
            if (innerWidth - mW < 200 || innerHeight - mH < 200) {
                scale = scale * 0.9999;
            }
        }
    } else {
        if (scalePointer > 100) {
            scalePointer = 100;
        }
        let modScale = 0.999 + ((scalePointer/100) * (0.9997-0.999));
        scale = scale * modScale;
    }

    if (!ctx.imageSmoothingEnabled && scale <= 1) {
        ctx.imageSmoothingEnabled = true;
    }

    margin.x = ((innerWidth - ((map[0].length + extraMargin.x) * SPRITE_SIZE * scale)) / 2);
    margin.y = ((innerHeight - ((map.length + extraMargin.y) * SPRITE_SIZE * scale)) / 2);
    drawFromOffscreenToScreen();

    window.requestAnimationFrame(gameLoop);
}

const updateLava = (lavaTile, now) => {
    if (now - lavaTile.lastSpread > lavaTile.timeout) {
        lavaTile.lastSpread = now;
        if (lavaTile.state === 1) {
            lavaTile.state = 2;
            map[lavaTile.y + origin.y][lavaTile.x + origin.x] = 14; // Lava rock
            drawTile(lavaTile.x + origin.x, lavaTile.y + origin.y, 14);
            return false;
        }

        if (lavaTile.state === 2) {
            lavaTile.timeout = getRandomIntInclusive(100, 900);
            lavaTile.state = 3;
            map[lavaTile.y + origin.y][lavaTile.x + origin.x] = 18; // Lava
            drawTile(lavaTile.x + origin.x, lavaTile.y + origin.y, 18);
            return false;
        }

        if (lavaTile.state === 3) {
            spreadLava(lavaTile.x + origin.x, lavaTile.y + origin.y);
            lavaTile.state = 4;
            map[lavaTile.y + origin.y][lavaTile.x + origin.x] = 19; // Magma
            drawTile(lavaTile.x + origin.x, lavaTile.y + origin.y, 19); // Magma
            return false;
        }

        if (lavaTile.state === 4) {
            lavaTile.state = 5;
            map[lavaTile.y + origin.y][lavaTile.x + origin.x] = 20; // Super Magma
            drawTile(lavaTile.x + origin.x, lavaTile.y + origin.y, 20); // Super Magma
            // ensureGameOver();
            return true;
        }
    }
}

const spreadLava = (x, y) => {
    [
        {x: 0, y: -1},
        {x: 1, y: 0},
        {x: 0, y: 1},
        {x: -1, y: 0}
    ].forEach(pos => {
        if (!map[y + pos.y] || map[y + pos.y][x + pos.x] === undefined) {
            gameOver = true;
            setTimeout(() => {
                canvas.style.opacity = 0;
                if (showInstructions > 0) {
                    // If you just let it run until it autodies
                    document.getElementById('instructions').remove();
                }
                setTimeout(() => {
                    document.getElementById('score-value').innerHTML = entitiesSpawned;
                    document.getElementById('score').style.display = 'block';
                    document.body.style.transition = 'background-color 2s';
                    document.body.style.backgroundColor = '#000';
                }, 1000);
            });
            return;
        }
        let tile = map[y + pos.y][x + pos.x];

        if (tile === 17) {
            map[y + pos.y][x + pos.x] = 13; // Steam
            drawTile(x + pos.x, y + pos.y, 13);
            lava.push({x: x + pos.x - origin.x, y: y + pos.y - origin.y, lastSpread: Date.now(), state: 1, timeout: getRandomIntInclusive(5000, 10000)});
        } else if ([15, 16].includes(tile)) { // Shallow water
            map[y + pos.y][x + pos.x] = 14; // Steam
            drawTile(x + pos.x, y + pos.y, 14);
            lava.push({x: x + pos.x - origin.x, y: y + pos.y - origin.y, lastSpread: Date.now(), state: 2, timeout: getRandomIntInclusive(5000, 10000)});
        } else if (![13, 14, 18, 19, 20].includes(tile)) {
            map[y + pos.y][x + pos.x] = 18; // Lava
            drawTile(x + pos.x, y + pos.y, 18);
            lava.push({x: x + pos.x - origin.x, y: y + pos.y - origin.y, lastSpread: Date.now(), state: 3, timeout: getRandomIntInclusive(100, 2000)});
        }
    });
}

const destroyTile = (x, y) => {
    if (x < 0 || y < 0 || x >= map[0].length || y >= map.length) return;

    x = parseInt(x);
    y = parseInt(y);

    let destroysTo = destroyMap[map[y][x]];
    if (destroysTo) {
        if (showInstructions > 0) {
            showInstructions--;
            if (showInstructions === 0) {
                document.getElementById('instructions').style.opacity = 0;
                setTimeout(() => {
                    document.getElementById('instructions').remove();
                }, 2000);
            }
        }
        
        spawnCooldown = spawnCooldown * 0.995;

        map[y][x] = destroysTo;
        drawTile(x, y, destroysTo);

        let regrowsTo = regrowMap[destroysTo];
        if (regrowsTo) {
            regrowTile(x, y, regrowsTo.tile, regrowsTo.timeout);
        }
    }
}

const regrowTile = (x, y, tile, timeout) => {
    let nextX = x - origin.x;
    let nextY = y - origin.y;
    setTimeout(() => {
        let x = nextX + origin.x;
        let y = nextY + origin.y;

        if ([13, 14, 18, 19, 20].includes(map[y][x])) return; // Do not overwrite lava

        map[y][x] = tile;
        drawTile(x, y, tile);
        let regrowsTo = regrowMap[tile];
        if (regrowsTo) {
            regrowTile(x, y, regrowsTo.tile, regrowsTo.timeout);
        }
    }, timeout);
}

const destroy = (mouseX, mouseY) => {
    mouseX = mouseX - margin.x;
    mouseY = mouseY - margin.y;

    let x = (mouseX / SPRITE_SIZE) / scale;
    let y = (mouseY / SPRITE_SIZE) / scale;

    let extra = scale < 4 ? Math.ceil(Math.pow(2, 2.5 - scale)) : 0;

    for (let mY = y - extra; mY <= y + extra; mY++) {
        for (let mX = x - extra; mX <= x + extra; mX++) {
            destroyTile(mX, mY);
        }
    }
}

const generateInitialLastSpawns = () => {
    let positions = [];
    for (let y = 0, yLen = map.length; y < yLen; y++) {
        for (let x = 0, xLen = map[y].length; x < xLen; x++) {
            if (x === 1 && y === 1) continue;
            positions.push({x: origin.x - x, y: origin.y - y});
        }
    }

    return positions.shuffle();
}

function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min);
}

const addEntity = (baseX, baseY, tries) => {
    tries = tries || 0;
    tries++;
    let success = [
        {x: 0, y: -1},
        {x: 1, y: 0},
        {x: 0, y: 1},
        {x: -1, y: 0}
    ]
        .shuffle()
        .some(pos => {
            let x = baseX + pos.x;
            let y = baseY + pos.y;
            if (map[y] && map[y][x]) {
                return false;
            }

            if (y === -1) {
                increaseMapSize(0, -1);
                y++; // Adjust new base
            }

            if (map[y] === undefined) {
                increaseMapSize(0, 1);
            }

            if (x === -1) {
                increaseMapSize(-1, 0);
                x++; // Adjust new base
            }

            if (map[y][x] === undefined) {
                increaseMapSize(1, 0);
            }

            map[y][x] = 1;
            spawns.push({x: x - origin.x, y: y - origin.y});
            drawTile(x, y, 1);
            return true;
        });

    if (!success) {
        if (tries > 5) {
            addEntity(getRandomIntInclusive(0, map[0].length - 1), getRandomIntInclusive(0, map.length - 1));
            return;
        }

        let radiusRight = map[0].length - 1 - origin.x;
        let radiusLeft = origin.x;
        let radiusTop = origin.y;
        let radiusBottom = map.length - 1 - origin.y;

        let minX, maxX, minY, maxY;
        if (radiusRight < radiusLeft) {
            minX = origin.x;
            maxX = map[0].length - 2;
        } else {
            minX = 1;
            maxX = origin.x;
        }

        if (radiusBottom < radiusTop) {
            minY = origin.y;
            maxY = map.length - 2;
        } else {
            minY = 1;
            maxY = origin.y;
        }

        addEntity(getRandomIntInclusive(minX, maxX), getRandomIntInclusive(minY, maxY), tries);
    }

    entitiesSpawned++;
}

const increaseEntities = amount => {
    let spawn = spawns[spawns.length - 1];
    for (let i = 0; i < amount; i++) {
        addEntity(origin.x + spawn.x, origin.y + spawn.y, i * 500);
    }
}

// TODO: Clean this up
const increaseMapSize = (x, y) => {
    if (x > 0) {
        shiftCanvas.width = offscreenCanvas.width + SPRITE_SIZE;
        shiftCtx.drawImage(offscreenCanvas, 0, 0);
        offscreenCanvas.width = offscreenCanvas.width + SPRITE_SIZE;
        offscreenCtx.drawImage(shiftCanvas, 0, 0);
        for (let y = 0, yLen = map.length; y < yLen; y++) {
            map[y].push(0);
        }
    }

    if (x < 0) {
        origin.x++;
        shiftCanvas.width = offscreenCanvas.width + SPRITE_SIZE;
        shiftCtx.drawImage(offscreenCanvas, 0, 0);
        offscreenCanvas.width = offscreenCanvas.width + SPRITE_SIZE;
        offscreenCtx.drawImage(shiftCanvas, SPRITE_SIZE, 0);
        // shiftOffscreen(1, 0);
        for (let y = 0, yLen = map.length; y < yLen; y++) {
            map[y].unshift(0);
        }
    }

    if (y > 0) {
        shiftCanvas.height = offscreenCanvas.height + SPRITE_SIZE;
        shiftCtx.drawImage(offscreenCanvas, 0, 0);
        offscreenCanvas.height = offscreenCanvas.height + SPRITE_SIZE;
        offscreenCtx.drawImage(shiftCanvas, 0, 0);
        map.push(Array(map[map.length - 1].length).fill(0));
    }

    if (y < 0) {
        origin.y++;
        shiftCanvas.height = offscreenCanvas.height + SPRITE_SIZE;
        shiftCtx.drawImage(offscreenCanvas, 0, 0);
        offscreenCanvas.height = offscreenCanvas.height + SPRITE_SIZE;
        offscreenCtx.drawImage(shiftCanvas, 0, SPRITE_SIZE);
        map.unshift(Array(map[0].length).fill(0));
    }

    setScale(true, x, y);
}

const increaseMapSize_new = () => {
    shiftCanvas.width = offscreenCanvas.width + SPRITE_SIZE;
    shiftCanvas.height = offscreenCanvas.height + SPRITE_SIZE;
    shiftCtx.drawImage(offscreenCanvas, 0, 0);
    offscreenCanvas.width = offscreenCanvas.width + SPRITE_SIZE;
    offscreenCanvas.height = offscreenCanvas.height + SPRITE_SIZE;
    offscreenCtx.drawImage(shiftCanvas, SPRITE_SIZE, SPRITE_SIZE);


    map.unshift(Array(map[0].length).fill(0));
    map.push(Array(map[map.length - 1].length).fill(0)); // Should always be same as map[0].length

    for (let y = 0, yLen = map.length; y < yLen; y++) {
        map[y].unshift(0);
        map[y].push(0);
    }

    setScale(true);
}

const setScale = (tweenIt, x, y) => {
    let screenAspectRatio = innerWidth / innerHeight;
    let mapAspectRatio = map[0].length / map.length;

    let widthScale = innerWidth / (map[0].length * SPRITE_SIZE);
    let heightScale =  innerHeight / (map.length * SPRITE_SIZE);

    let newScale = mapAspectRatio < screenAspectRatio ? heightScale : widthScale;

    if (tweenIt) {
        extraMargin.x -= x;
        extraMargin.y -= y;
        return;
    }

    let newMarginX = (innerWidth - (map[0].length * SPRITE_SIZE * newScale)) / 2;
    let newMarginY = (innerHeight - (map.length * SPRITE_SIZE * newScale)) / 2;

    scale = newScale;
    margin.x = newMarginX;
    margin.y = newMarginY;
}

const drawTile = (x, y, tile) => {
    offscreenCtx.clearRect(x * SPRITE_SIZE, y * SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE);
    offscreenCtx.drawImage(
        ss,
        // source
        // scale <= 1/16 ? SPRITE_SIZE : 0, 
        (tile - 1) * SPRITE_SIZE,
        0, 
        SPRITE_SIZE, 
        SPRITE_SIZE, 
        // destination
        x * SPRITE_SIZE, 
        y * SPRITE_SIZE, 
        SPRITE_SIZE, 
        SPRITE_SIZE
    );

    if (warningShown && currentStage === 0 && x === origin.x && y === origin.y) {
        offscreenCtx.drawImage(
            ss,
            // source
            // scale <= 1/16 ? SPRITE_SIZE : 0, 
            (12 - 1) * SPRITE_SIZE,
            0, 
            SPRITE_SIZE, 
            SPRITE_SIZE, 
            // destination
            x * SPRITE_SIZE, 
            y * SPRITE_SIZE, 
            SPRITE_SIZE, 
            SPRITE_SIZE
        );
    }

    drawFromOffscreenToScreen();
}

const drawFromOffscreenToScreen = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(
        offscreenCanvas,                
        // source
        0, 
        0, 
        offscreenCanvas.width, 
        offscreenCanvas.height, 
        // destination
        margin.x, 
        margin.y, 
        offscreenCanvas.width * scale, 
        offscreenCanvas.height * scale
    );
}

const drawAll = () => {
    for (let y = 0, yLen = map.length; y < yLen; y++) {
        for (let x = 0, xLen = map[y].length; x < xLen; x++) {
            if (map[y][x] === 0) continue;
            drawTile(x, y, map[y][x]);
        }
    }
}