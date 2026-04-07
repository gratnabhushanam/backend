const { Sloka, Story, Video, Movie } = require('../models');
const { Op } = require('sequelize');
const { mapSloka, mapStory, mapVideo, mapMovie } = require('../utils/responseMappers');
const mockContentStore = require('../utils/mockContentStore');
const { isMockMode } = require('./authController');

const containsQuery = (value, query) => String(value || '').toLowerCase().includes(String(query || '').toLowerCase());

const storyMatches = (story, query) => (
  containsQuery(story.title, query)
  || containsQuery(story.titleTelugu, query)
  || containsQuery(story.titleHindi, query)
  || containsQuery(story.titleEnglish, query)
  || containsQuery(story.summary, query)
  || containsQuery(story.summaryTelugu, query)
  || containsQuery(story.summaryHindi, query)
  || containsQuery(story.summaryEnglish, query)
  || containsQuery(story.content, query)
  || containsQuery(story.contentTelugu, query)
  || containsQuery(story.contentHindi, query)
  || containsQuery(story.contentEnglish, query)
  || containsQuery(story.seriesTitle, query)
);

const videoMatches = (video, query) => (
  containsQuery(video.title, query)
  || containsQuery(video.description, query)
  || containsQuery(video.category, query)
  || containsQuery(video.language, query)
  || containsQuery(video.moral, query)
);

const movieMatches = (movie, query) => (
  containsQuery(movie.title, query)
  || containsQuery(movie.description, query)
  || containsQuery(movie.ownerHistory, query)
  || containsQuery(movie.releaseYear, query)
  || (Array.isArray(movie.tags) && movie.tags.some((tag) => containsQuery(tag, query)))
);

const isSearchableVideo = (video) => {
  const isUserReel = Boolean(video?.isUserReel);
  const category = String(video?.category || '').trim().toLowerCase();
  return !isUserReel && category !== 'reels';
};

const searchMockContent = (query) => ({
  slokas: [],
  stories: mockContentStore.listStories().filter((story) => storyMatches(story, query)).map(mapStory),
  videos: mockContentStore
    .listVideos()
    .filter((video) => isSearchableVideo(video))
    .filter((video) => videoMatches(video, query))
    .map(mapVideo),
  movies: mockContentStore.listMovies().filter((movie) => movieMatches(movie, query)).map((movie) => mapMovie(movie)),
});

exports.searchAll = async (req, res) => {
  try {
    const { q } = req.query;
    const normalizedQuery = String(q || '').trim();

    if (!normalizedQuery) {
      if (isMockMode()) {
        return res.json(searchMockContent(''));
      }

      const [slokas, stories, videos, movies] = await Promise.all([
        Sloka.findAll(),
        Story.findAll({
          attributes: ['id', 'title', 'summary', 'content', 'chapter', 'language', 'thumbnail', 'tags', 'createdBy', 'createdAt', 'updatedAt'],
        }),
        Video.findAll({
          attributes: ['id', 'title', 'description', 'videoUrl', 'youtubeUrl', 'thumbnail', 'category', 'language', 'duration', 'tags', 'views', 'isKids', 'isUserReel', 'uploadedBy', 'uploadSource', 'contentType', 'moderationStatus', 'moderationNote', 'reviewedBy', 'likesCount', 'sharesCount', 'commentsCount', 'likedBy', 'comments', 'chapter', 'moral', 'script', 'createdAt', 'updatedAt'],
          where: {
            isUserReel: { [Op.not]: true },
          },
        }),
        Movie.findAll({
          attributes: ['id', 'title', 'description', 'videoUrl', 'youtubeUrl', 'thumbnail', 'releaseYear', 'ownerHistory', 'tags', 'createdAt', 'updatedAt'],
        }),
      ]);

      return res.json({
        slokas: slokas.map(mapSloka),
        stories: stories.map(mapStory),
        videos: videos.filter((video) => isSearchableVideo(video)).map(mapVideo),
        movies: movies.map((movie) => mapMovie(movie)),
      });
    }

    if (isMockMode()) {
      return res.json(searchMockContent(normalizedQuery));
    }

    const [slokas, stories, videos, movies] = await Promise.all([
      Sloka.findAll({
        where: {
          [Op.or]: [
            { sanskrit: { [Op.like]: `%${q}%` } },
            { englishMeaning: { [Op.like]: `%${q}%` } },
            { teluguMeaning: { [Op.like]: `%${q}%` } }
          ]
        }
      }),
      Story.findAll({
        attributes: ['id', 'title', 'summary', 'content', 'chapter', 'language', 'thumbnail', 'tags', 'createdBy', 'createdAt', 'updatedAt'],
        where: {
          [Op.or]: [
            { title: { [Op.like]: `%${q}%` } },
            { summary: { [Op.like]: `%${q}%` } },
            { content: { [Op.like]: `%${q}%` } }
          ]
        }
      }),
      Video.findAll({
        attributes: ['id', 'title', 'description', 'videoUrl', 'youtubeUrl', 'thumbnail', 'category', 'language', 'duration', 'tags', 'views', 'isKids', 'isUserReel', 'uploadedBy', 'uploadSource', 'contentType', 'moderationStatus', 'moderationNote', 'reviewedBy', 'likesCount', 'sharesCount', 'commentsCount', 'likedBy', 'comments', 'chapter', 'moral', 'script', 'createdAt', 'updatedAt'],
        where: {
          [Op.and]: [
            { isUserReel: { [Op.not]: true } },
            {
              [Op.or]: [
                { title: { [Op.like]: `%${q}%` } },
                { description: { [Op.like]: `%${q}%` } },
                { category: { [Op.like]: `%${q}%` } },
                { language: { [Op.like]: `%${q}%` } }
              ]
            }
          ]
        }
      }),
      Movie.findAll({
        where: {
          [Op.or]: [
            { title: { [Op.like]: `%${q}%` } },
            { description: { [Op.like]: `%${q}%` } },
            { ownerHistory: { [Op.like]: `%${q}%` } }
          ]
        }
      })
    ]);

    res.json({
      slokas: slokas.map(mapSloka),
      stories: stories.map(mapStory),
      videos: videos.filter((video) => isSearchableVideo(video)).map(mapVideo),
      movies: movies.map(mapMovie),
    });
  } catch (error) {
    if (String(error.message || '').toLowerCase().includes('no such column')) {
      return res.json(searchMockContent(String(req.query?.q || '').trim()));
    }

    res.status(500).json({ message: error.message });
  }
};
