const fs = require('fs');
const path = require('path');

let mockMovies = [];
let mockStories = [];
let mockVideos = [];

let nextMovieId = 1;
let nextStoryId = 1;
let nextVideoId = 1;

const STORE_FILE = path.join(__dirname, '..', 'data', 'mockContentStore.json');

const now = () => new Date().toISOString();

const loadStore = () => {
  try {
    if (!fs.existsSync(STORE_FILE)) return;
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw);
    mockMovies = Array.isArray(parsed.mockMovies) ? parsed.mockMovies : [];
    mockStories = Array.isArray(parsed.mockStories) ? parsed.mockStories : [];
    mockVideos = Array.isArray(parsed.mockVideos) ? parsed.mockVideos : [];
    nextMovieId = Number(parsed.nextMovieId) || (mockMovies.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1);
    nextStoryId = Number(parsed.nextStoryId) || (mockStories.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1);
    nextVideoId = Number(parsed.nextVideoId) || (mockVideos.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1);
  } catch {
    // fall back to in-memory empty store
  }
};

const saveStore = () => {
  try {
    const payload = {
      mockMovies,
      mockStories,
      mockVideos,
      nextMovieId,
      nextStoryId,
      nextVideoId,
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch {
    // ignore persistence failures
  }
};

loadStore();

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
};

const addMovie = (payload) => {
  const movie = {
    id: nextMovieId++,
    title: payload.title,
    description: payload.description || '',
    videoUrl: payload.videoUrl || payload.youtubeUrl,
    youtubeUrl: payload.videoUrl || payload.youtubeUrl,
    thumbnail: payload.thumbnail || '',
    releaseYear: Number(payload.releaseYear) || new Date().getFullYear(),
    ownerHistory: payload.ownerHistory || '',
    tags: normalizeTags(payload.tags),
    createdAt: now(),
    updatedAt: now(),
  };
  mockMovies.push(movie);
  saveStore();
  return movie;
};

const listMovies = () => [...mockMovies].sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));

const deleteMovie = (id) => {
  const movieId = Number(id);
  const index = mockMovies.findIndex((movie) => Number(movie.id) === movieId);
  if (index === -1) return null;
  const [removed] = mockMovies.splice(index, 1);
  saveStore();
  return removed;
};

const addStory = (payload) => {
  const story = {
    id: nextStoryId++,
    title: payload.title || payload.titleEnglish || payload.titleHindi || payload.titleTelugu || 'Untitled Story',
    titleTelugu: payload.titleTelugu || '',
    titleHindi: payload.titleHindi || '',
    titleEnglish: payload.titleEnglish || '',
    seriesTitle: payload.seriesTitle || 'Bhagavad Gita',
    slug: payload.slug || null,
    summary: payload.summary || '',
    summaryTelugu: payload.summaryTelugu || '',
    summaryHindi: payload.summaryHindi || '',
    summaryEnglish: payload.summaryEnglish || '',
    content: payload.content || '',
    contentTelugu: payload.contentTelugu || '',
    contentHindi: payload.contentHindi || '',
    contentEnglish: payload.contentEnglish || '',
    chapter: Number(payload.chapter) || 1,
    language: payload.language || 'telugu',
    thumbnail: payload.thumbnail || '',
    tags: normalizeTags(payload.tags),
    bgmEnabled: payload.bgmEnabled !== false,
    bgmPreset: payload.bgmPreset || 'temple',
    createdBy: payload.createdBy || null,
    createdAt: now(),
    updatedAt: now(),
  };
  mockStories.push(story);
  saveStore();
  return story;
};

const listStories = () => [...mockStories];

const deleteStory = (id) => {
  const storyId = Number(id);
  const index = mockStories.findIndex((story) => Number(story.id) === storyId);
  if (index === -1) return null;
  const [removed] = mockStories.splice(index, 1);
  saveStore();
  return removed;
};

const replaceStory = (id, updatedStory) => {
  const storyId = Number(id);
  const index = mockStories.findIndex((story) => Number(story.id) === storyId);
  if (index === -1) return null;
  mockStories[index] = {
    ...mockStories[index],
    ...updatedStory,
    title: updatedStory.title
      || updatedStory.titleEnglish
      || updatedStory.titleHindi
      || updatedStory.titleTelugu
      || mockStories[index].title,
    seriesTitle: updatedStory.seriesTitle || mockStories[index].seriesTitle || 'Bhagavad Gita',
    bgmEnabled: typeof updatedStory.bgmEnabled === 'boolean' ? updatedStory.bgmEnabled : mockStories[index].bgmEnabled !== false,
    bgmPreset: updatedStory.bgmPreset || mockStories[index].bgmPreset || 'temple',
    id: mockStories[index].id,
    updatedAt: now(),
  };
  saveStore();
  return mockStories[index];
};

const addVideo = (payload) => {
  const video = {
    id: nextVideoId++,
    title: payload.title,
    description: payload.description || '',
    videoUrl: payload.videoUrl || payload.youtubeUrl,
    youtubeUrl: payload.videoUrl || payload.youtubeUrl,
    thumbnail: payload.thumbnail || '',
    category: payload.category || 'reels',
    language: payload.language || 'telugu',
    duration: payload.duration || '',
    tags: normalizeTags(payload.tags),
    views: Number(payload.views) || 0,
    isKids: Boolean(payload.isKids),
    isUserReel: Boolean(payload.isUserReel),
    uploadedBy: payload.uploadedBy || null,
    uploadSource: payload.uploadSource || 'admin',
    contentType: payload.contentType || 'other',
    moderationStatus: payload.moderationStatus || 'approved',
    moderationNote: payload.moderationNote || '',
    reviewedBy: payload.reviewedBy || null,
    likesCount: Number(payload.likesCount) || 0,
    sharesCount: Number(payload.sharesCount) || 0,
    commentsCount: Number(payload.commentsCount) || 0,
    likedBy: Array.isArray(payload.likedBy) ? payload.likedBy : [],
    comments: Array.isArray(payload.comments) ? payload.comments : [],
    chapter: payload.chapter ? Number(payload.chapter) : null,
    moral: payload.moral || '',
    script: payload.script || '',
    createdAt: now(),
    updatedAt: now(),
  };
  mockVideos.push(video);
  saveStore();
  return video;
};

const listVideos = () => [...mockVideos];

const deleteVideo = (id) => {
  const videoId = Number(id);
  const index = mockVideos.findIndex((video) => Number(video.id) === videoId);
  if (index === -1) return null;
  const [removed] = mockVideos.splice(index, 1);
  saveStore();
  return removed;
};

const getCounts = () => ({
  totalMovies: mockMovies.length,
  totalStories: mockStories.length,
  totalVideos: mockVideos.length,
});

module.exports = {
  addMovie,
  listMovies,
  deleteMovie,
  addStory,
  listStories,
  deleteStory,
  replaceStory,
  addVideo,
  listVideos,
  deleteVideo,
  getCounts,
};