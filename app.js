// =============================================
// MIXTAPE APP — Main Logic
// =============================================

// ---- Audio warmup ----
const silentAudio = new Audio('sounds/silent.m4a');
document.addEventListener('touchstart', () => {
  silentAudio.play().then(() => {
    AudioFX.resume();
  }).catch(() => {});
}, { once: true });

// ---- State ----
let currentFriendIdx = null;
let currentSongIdx = 0;
let isPlaying = false;
let ffSource = null;          // fast-forward audio node
let lyricsInterval = null;
let lyricsLineIdx = 0;
let isFastForwarding = false;

// ---- DOM refs ----
const pageShelf = document.getElementById('page-shelf');
const pagePlayer = document.getElementById('page-player');
const shelfPreviewHint = document.querySelector('.preview-hint');
const previewContent = document.getElementById('preview-content');
const previewImg = document.getElementById('preview-img');
const previewSongsCount = document.getElementById('preview-songs-count');
const previewInsertBtn = document.getElementById('preview-insert-btn');
const spineHotspots = document.querySelectorAll('.spine-hotspot');

const deckCassetteImg = document.getElementById('deck-cassette-img');
const spoolLeft = document.getElementById('spool-left');
const spoolRight = document.getElementById('spool-right');
const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
const trackCounter = document.getElementById('track-counter');
const btnPlay = document.getElementById('btn-play');
const btnPrev = document.getElementById('btn-prev');
const btnRewind = document.getElementById('btn-rewind');  // repurposed as prev track
const btnFF = document.getElementById('btn-ff');
const btnEject = document.getElementById('btn-eject');
const songCardImg = document.getElementById('song-card-img');
const songCardPlaceholder = document.getElementById('song-card-placeholder');
const lyricsBox = document.getElementById('lyrics-box');
const playerTitle = document.querySelector('.player-title');
const ejectHint = `<p style="font-size:1rem;">end of tape -- press <svg width="16" height="16" viewBox="0 0 100 100" style="vertical-align:middle;display:inline-block;margin: 0 2px;"><polygon points="50,10 90,60 10,60" fill="white"/><rect x="10" y="68" width="80" height="18" rx="3" fill="white"/></svg> to go back to shelf</p>`;
const playHint = `<p style="font-size:1rem;">2. press ▶ to start track</p>`
const backHint = `<p style="font-size:1rem;">3. press <svg width="16" height="16" viewBox="0 0 100 100" style="vertical-align:middle;display:inline-block;margin: 0 2px;"><polygon points="50,10 90,60 10,60" fill="white"/><rect x="10" y="68" width="80" height="18" rx="3" fill="white"/></svg> to return</p>`;

let toggleHintShown = false;
function showToggleHint() {
  AudioFX.resume(); 
  let msg = document.querySelector('.hint-msg');
  const hint = `<p style="font-size:1rem;">1. tap cassette to see card</p>${playHint}${backHint}`;
  if (!msg) {
    msg = document.createElement('div');
    msg.className = 'hint-msg';
    msg.innerHTML = hint;
    document.body.appendChild(msg);
  }
  msg.classList.add('visible');
  setTimeout(() => msg.classList.remove('visible'), 5000);
  toggleHintShown = true;
}

function onYTStateChange(e) {
  if (e.data === YT.PlayerState.ENDED) {
    onTrackEnded();
  }
  if (e.data === YT.PlayerState.PLAYING) {
    setPlaying(true);
  }
  if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.BUFFERING) {
    // don't change UI on buffering
    if (e.data === YT.PlayerState.PAUSED) setPlaying(false);
  }
}

// Inject YouTube API script
document.addEventListener('DOMContentLoaded', () => {
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
});

document.addEventListener('touchstart', () => {
  AudioFX.resume();
}, { once: true });

document.addEventListener('click', () => {
  AudioFX.resume();
}, { once: true });

// Also warm up on first hotspot touch specifically
spineHotspots.forEach(hotspot => {
  hotspot.addEventListener('touchstart', () => {
    AudioFX.resume();
  }, { once: true });
});

// ---- Shelf interactions ----
spineHotspots.forEach(hotspot => {
  hotspot.addEventListener('mouseenter', () => {
    if (window.innerWidth <= 600) return;  // skip preview on mobile
    const idx = parseInt(hotspot.dataset.friend);
    showPreview(idx);
    spineHotspots.forEach(h => h.classList.remove('active-spine'));
    hotspot.classList.add('active-spine');
  });

  hotspot.addEventListener('mouseleave', () => {
    // Keep preview visible until another is hovered or user leaves shelf container
  });

  hotspot.addEventListener('click', () => {
    const idx = parseInt(hotspot.dataset.friend);
    insertCassette(idx);
  });
});

// Hide preview when leaving the shelf container entirely
document.querySelector('.shelf-container').addEventListener('mouseleave', () => {
  spineHotspots.forEach(h => h.classList.remove('active-spine'));
});

function showPreview(idx) {
  const friend = FRIENDS[idx];
  shelfPreviewHint.style.display = 'none';
  previewContent.style.display = 'flex';
  previewImg.src = friend.previewImage || friend.cassetteImage;
  previewImg.alt = `cassette for ${friend.name}`;
  previewSongsCount.textContent = `${friend.songs.length} songs`;
  previewInsertBtn.onclick = () => insertCassette(idx);
  applyTheme(friend);
}

// ---- Insert cassette → go to player ----
function insertCassette(idx) {
  setTimeout(() => AudioFX.click(), 80);
  currentFriendIdx = idx;
  currentSongIdx = 0;
  isPlaying = false;

  const friend = FRIENDS[idx];
  applyTheme(friend);

  // Set up deck
  deckCassetteImg.src = friend.cassetteImage;
  setSpoolsSpin(false);

  // Load first song UI (don't autoplay)
  loadSongUI(currentSongIdx);

  if (friend.coverImage) {
    songCardImg.src = friend.coverImage;
    songCardImg.style.display = 'block';
    songCardPlaceholder.style.display = 'none';
  }

  // Switch pages
  pageShelf.classList.remove('active');
  pagePlayer.classList.add('active');
  window.scrollTo(0, 0);
  // if (!toggleHintShown) showToggleHint();
}

// ---- Apply friend colour theme ----
function applyTheme(friend) {
  document.documentElement.style.setProperty('--theme', friend.themeColor);
  document.documentElement.style.setProperty('--theme-dark', friend.themeDark);
}

// ---- Load a song into the UI (no autoplay) ----
function loadSongUI(songIdx) {
  const friend = FRIENDS[currentFriendIdx];
  const song = friend.songs[songIdx];

  // trackTitle.textContent = song.title;
  // trackArtist.textContent = song.artist;
  // trackCounter.textContent = `track ${songIdx + 1} / ${friend.songs.length}`;

  // Song card
  if (song.cardImage) {
    songCardImg.src = song.cardImage;
    songCardImg.style.display = 'block';
    songCardPlaceholder.style.display = 'none';
    songCardImg.onerror = () => {
      songCardImg.style.display = 'none';
      songCardPlaceholder.style.display = 'flex';
    };
  } else {
    songCardImg.style.display = 'none';
    songCardPlaceholder.style.display = 'flex';
  }

  // Reset lyrics
  clearLyrics();

  btnPlay.textContent = '▶';
}

// ---- Play / Pause ----
btnPlay.addEventListener('click', () => {
  AudioFX.resume();
  if (!isPlaying) {
    playCurrentSong();
  } else {
    pauseCurrentSong();
  }
});

let audioEl = new Audio();
audioEl.onended = onTrackEnded;
function playCurrentSong() {
  AudioFX.resume();
  const song = FRIENDS[currentFriendIdx].songs[currentSongIdx];

  const cardImg = document.getElementById('song-card-img');
  const placeholder = document.getElementById('song-card-placeholder');
  if (song.cardImage) {
    cardImg.src = song.cardImage;
    cardImg.style.display = 'block';
    placeholder.style.display = 'none';
    cardImg.onerror = () => {
      cardImg.style.display = 'none';
      placeholder.style.display = 'flex';
    };
  }
  if (currentSongIdx === 0 && !isPlaying) {
    AudioFX.hiss(1.5);
    setTimeout(() => {
      audioEl.src = song.audioFile;
      audioEl.play();
    }, 1500);
  } else {
    audioEl.src = song.audioFile;
    audioEl.play();
  }
  setPlaying(true);
  startLyrics();
}

function pauseCurrentSong() {
  audioEl.pause();
  setPlaying(false);
  pauseLyrics();
}

function setPlaying(val) {
  isPlaying = val;
  btnPlay.textContent = val ? '⏸' : '▶';
  setSpoolsSpin(val);
}

// ---- Track ended ----
function onTrackEnded() {
  console.log('track ended');
  const friend = FRIENDS[currentFriendIdx];
  if (currentSongIdx < friend.songs.length - 1) {
    triggerFastForward(() => {
      currentSongIdx++;
      loadSongUI(currentSongIdx);
      playCurrentSong();
    });
  } else {
    // End of tape
    setPlaying(false);
    AudioFX.stop();
    clearLyrics();
    showTapeEndMessage();
  }
}

// ---- Previous track ----
btnPrev.addEventListener('click', () => {
  if (isFastForwarding) return;
  if (currentSongIdx > 0) {
    AudioFX.click();
    const wasPlaying = isPlaying;
    setPlaying(false);
    clearLyrics();
    currentSongIdx--;
    loadSongUI(currentSongIdx);
    if (wasPlaying) playCurrentSong();
  }
});

// ---- Rewind = same as prev (per spec) ----
btnRewind.addEventListener('click', () => {
  btnPrev.click();
});

// ---- Fast forward = next track ----
btnFF.addEventListener('click', () => {
  if (isFastForwarding) return;
  const friend = FRIENDS[currentFriendIdx];
  if (currentSongIdx < friend.songs.length - 1) {
    const wasPlaying = isPlaying;
    setPlaying(false);
    clearLyrics();
    triggerFastForward(() => {
      currentSongIdx++;
      loadSongUI(currentSongIdx);
      if (wasPlaying) playCurrentSong();
    });
  }
});

// ---- Fast forward animation + sound ----
function triggerFastForward(onDone) {
  isFastForwarding = true;
  const overlay = getFFOverlay();
  overlay.classList.add('visible');
  spoolLeft.style.animationDuration = '0.5s';
  spoolRight.style.animationDuration = '0.5s';
  spoolLeft.classList.add('spinning');
  spoolRight.classList.add('spinning');

  AudioFX.fastForward(() => {
    overlay.classList.remove('visible');
    spoolLeft.style.animationDuration = '';
    spoolRight.style.animationDuration = '';
    isFastForwarding = false;
    onDone();
  });
}

function getFFOverlay() {
  let el = document.querySelector('.ff-overlay');
  if (!el) {
    el = document.createElement('div');
    el.className = 'ff-overlay';
    el.innerHTML = `<img src="images/ff.png" alt="" style="width:320px;height:auto;" />`;
    document.body.appendChild(el);
  }
  return el;
}

// ---- Eject ----
btnEject.addEventListener('click', () => {
  AudioFX.click();
  audioEl.pause();  // add this line
  audioEl.src = '';
  setPlaying(false);
  clearLyrics();

  // Reset theme
  document.documentElement.style.setProperty('--theme', '#aaaaaa');
  document.documentElement.style.setProperty('--theme-dark', '#666666');

  // Reset preview panel
  shelfPreviewHint.style.display = '';
  previewContent.style.display = 'none';
  spineHotspots.forEach(h => h.classList.remove('active-spine'));

  pagePlayer.classList.remove('active');
  pageShelf.classList.add('active');
  window.scrollTo(0, 0);
});

// ---- Toggle Player card ----
const cardToggleBtn = document.getElementById('card-toggle-btn');
const playerRight = document.querySelector('.player-right');

// This collapses player card by default
// playerRight.classList.add('collapsed');
// cardToggleBtn.textContent = '▶';

cardToggleBtn.addEventListener('click', () => {
  playerRight.classList.toggle('collapsed');
  cardToggleBtn.textContent = playerRight.classList.contains('collapsed') ? '▶' : '◀';
});

document.getElementById('deck').addEventListener('click', () => {
  const isCollapsed = playerRight.classList.contains('collapsed');
  if (isCollapsed) {
    playerRight.classList.remove('collapsed');
    cardToggleBtn.textContent = '◀';
  } else {
    playerRight.classList.add('collapsed');
    cardToggleBtn.textContent = '▶';
  }
});

// ---- Spools ----
function setSpoolsSpin(spin) {
  if (spin) {
    spoolLeft.classList.add('spinning');
    spoolRight.classList.add('spinning');
  } else {
    spoolLeft.classList.remove('spinning');
    spoolRight.classList.remove('spinning');
  }
}

// ---- Lyrics (Option B: sequential, typewriter) ----
const LYRICS_INTERVAL_MS = 4700; // new line every 13 seconds

function clearLyrics() {
  if (lyricsInterval) { clearInterval(lyricsInterval); lyricsInterval = null; }
  lyricsBox.innerHTML = '';
  lyricsLineIdx = 0;
}

function pauseLyrics() {
  if (lyricsInterval) { clearInterval(lyricsInterval); lyricsInterval = null; }
}

function startLyrics() {
  const song = FRIENDS[currentFriendIdx].songs[currentSongIdx];
  if (!song.lyrics || song.lyrics.length === 0) return;

  // Type the first line immediately
  typewriterLine(song.lyrics[lyricsLineIdx] || '');
  lyricsLineIdx++;

  lyricsInterval = setInterval(() => {
    if (lyricsLineIdx >= song.lyrics.length) {
      clearInterval(lyricsInterval);
      lyricsInterval = null;
      return;
    }
    typewriterLine(song.lyrics[lyricsLineIdx]);
    lyricsLineIdx++;
  }, LYRICS_INTERVAL_MS);
}

function typewriterLine(text) {
  // Remove old cursor if any
  const oldCursor = lyricsBox.querySelector('.cursor');
  if (oldCursor) oldCursor.remove();

  const lineEl = document.createElement('span');
  lineEl.className = 'lyrics-line';
  lyricsBox.appendChild(lineEl);

  // Scroll lyrics box to bottom
  lyricsBox.parentElement.scrollTop = lyricsBox.parentElement.scrollHeight;

  // Add cursor
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  lineEl.appendChild(cursor);

  // Type characters one by one
  let charIdx = 0;
  const speed = 70; // ms per character

  const typeInterval = setInterval(() => {
    if (charIdx < text.length) {
      // Insert char before cursor
      cursor.insertAdjacentText('beforebegin', text[charIdx]);
      charIdx++;
      // Keep scrolled
      lyricsBox.parentElement.scrollTop = lyricsBox.parentElement.scrollHeight;
    } else {
      clearInterval(typeInterval);
      // Add newline after line
      lineEl.insertAdjacentText('afterend', '\n');
      // Leave cursor blinking on last line
    }
  }, speed);
}

// ---- End of tape message ----
function showTapeEndMessage() {
  let msg = document.querySelector('.tape-end-msg');
  if (!msg) {
    msg = document.createElement('div');
    msg.className = 'tape-end-msg';
    msg.innerHTML = ejectHint;
    document.body.appendChild(msg);
  }
  msg.classList.add('visible');
  setTimeout(() => msg.classList.remove('visible'), 4000);
}
