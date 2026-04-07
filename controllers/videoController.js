const { Video, User } = require('../models');
const { mapVideo } = require('../utils/responseMappers');
const mockContentStore = require('../utils/mockContentStore');
const { isMockMode } = require('./authController');
const fs = require('fs');
const { getVideoDurationSeconds } = require('../utils/videoMetadata');

const MAX_REEL_DURATION_SECONDS = 90;

const SPIRITUAL_KEYWORDS = [
  'krishna',
  'shiva',
  'mahadev',
  'ganesha',
  'vinayaka',
  'hanuman',
  'rama',
  'sita',
  'durga',
  'lakshmi',
  'saraswati',
  'kali',
  'murugan',
  'ayyappa',
  'vishnu',
  'narasimha',
  'venkateswara',
  'tirupati',
  'srinivasa',
  'gita',
  'bhagavad',
  'bhagavadgita',
  'sloka',
  'shloka',
  'sri krishna',
  'lord krishna',
  'vasudeva',
  'govinda',
  'madhava',
  'narayana',
  'paramatma',
  'atman',
  'bhakti',
  'jnana',
  'gyana',
  'karma yoga',
  'bhakti yoga',
  'raja yoga',
  'dhyana',
  'spiritual',
  'dharma',
  'adharma',
  'yoga',
  'devotion',
  'veda',
  'vedanta',
  'upanishad',
  'sanatana',
  'sanatana dharma',
  'mantra',
  'japa',
  'seva',
  'satsang',
  'meditation',
  'karma',
  'moksha',
  'bhajan',
  'kirtan',
  'telugu sloka',
  'geeta',
  'gita verse',
  'ram',
  'hari'
];

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) return tags.filter(Boolean);
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
};

const isSpiritualContent = ({ title, description, tags }) => {
  const joined = `${title || ''} ${description || ''} ${normalizeTags(tags).join(' ')}`.toLowerCase();
  return SPIRITUAL_KEYWORDS.some((keyword) => joined.includes(keyword));
};

const toIntId = (value) => Number(value);

const getPublicBaseUrl = (req) => `${req.protocol}://${req.get('host')}`;
const buildUploadedVideoUrl = (req, fileName) => `${getPublicBaseUrl(req)}/uploads/reels/${fileName}`;

exports.getVideos = async (req, res) => {
  try {
    if (isMockMode()) {
      return res.json(mockContentStore.listVideos().map(mapVideo));
    }

    const videos = await Video.findAll();
    res.json(videos.map(mapVideo));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addVideo = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      videoUrl: req.body.videoUrl || req.body.youtubeUrl,
      uploadSource: 'admin',
      moderationStatus: 'approved',
      contentType: req.body.contentType || 'other',
    };

    if (isMockMode()) {
      const newVideo = mockContentStore.addVideo(payload);
      return res.status(201).json(mapVideo(newVideo));
    }

    const newVideo = await Video.create(payload);
    res.status(201).json(mapVideo(newVideo));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getReels = async (req, res) => {
  try {
    if (isMockMode()) {
      const { category } = req.query;
      let videos = mockContentStore.listVideos().filter((v) => !v.isUserReel);
      if (category) {
        videos = videos.filter((v) => v.category === category);
      }
      return res.json(videos.slice(0, 10).map(mapVideo));
    }

    const { category } = req.query;
    let where = { isUserReel: false };
    if (category) {
      where.category = category;
    }
    const videos = await Video.findAll({
      where,
      limit: 10
    });
    res.json(videos.map(mapVideo));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getKidsVideos = async (req, res) => {
  try {
    if (isMockMode()) {
      const videos = mockContentStore
        .listVideos()
        .filter((v) => Boolean(v.isKids))
        .sort((a, b) => (a.chapter || 0) - (b.chapter || 0));
      return res.json(videos.map(mapVideo));
    }

    const videos = await Video.findAll({
      where: { isKids: true },
      order: [['chapter', 'ASC']]
    });
    res.json(videos.map(mapVideo));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.uploadUserReel = async (req, res) => {
  try {
    const { title, description, tags } = req.body;
    const normalizedTags = normalizeTags(tags);
    const uploadedFile = req.file;
    const videoUrl = uploadedFile?.filename ? buildUploadedVideoUrl(req, uploadedFile.filename) : '';

    if (!title || !videoUrl) {
      return res.status(400).json({ message: 'Title and video file are required' });
    }

    const duration = await getVideoDurationSeconds(uploadedFile.path);
    if (duration > MAX_REEL_DURATION_SECONDS) {
      fs.unlink(uploadedFile.path, () => {});
      return res.status(400).json({ message: `Reel must be ${MAX_REEL_DURATION_SECONDS} seconds or less` });
    }

    const detectedSpiritual = isSpiritualContent({ title, description, tags: normalizedTags });

    const isAdminUploader = req.user?.role === 'admin';

    if (!detectedSpiritual && !isAdminUploader) {
      fs.unlink(uploadedFile.path, () => {});
      return res.status(400).json({
        message: 'Only spiritual content reels are allowed for user uploads.',
      });
    }

    const moderationStatus = isAdminUploader ? 'approved' : 'pending';

    if (isMockMode()) {
      const newReel = mockContentStore.addVideo({
        title,
        videoUrl,
        description,
        tags: normalizedTags,
        category: 'reels',
        isUserReel: true,
        uploadedBy: req.user.id,
        uploadSource: isAdminUploader ? 'admin' : 'user',
        contentType: detectedSpiritual ? 'spiritual' : 'other',
        moderationStatus,
        likesCount: 0,
        sharesCount: 0,
        commentsCount: 0,
        likedBy: [],
        comments: [],
      });
      return res.status(201).json(mapVideo(newReel));
    }

    const newReel = await Video.create({
      title,
      videoUrl,
      description,
      tags: normalizedTags,
      category: 'reels',
      isUserReel: true,
      uploadedBy: req.user.id,
      uploadSource: isAdminUploader ? 'admin' : 'user',
      contentType: 'spiritual',
      moderationStatus,
      likesCount: 0,
      sharesCount: 0,
      commentsCount: 0,
      likedBy: [],
      comments: [],
    });
    res.status(201).json({
      ...mapVideo(newReel),
      message: moderationStatus === 'pending'
        ? 'Spiritual reel uploaded and sent for admin review'
        : 'Reel uploaded successfully',
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getUserReels = async (req, res) => {
  try {
    if (isMockMode()) {
      const reels = mockContentStore
        .listVideos()
        .filter(
          (v) =>
            Boolean(v.isUserReel) &&
            v.moderationStatus === 'approved' &&
            String(v.contentType || 'other') === 'spiritual'
        );
      return res.json(reels.map(mapVideo));
    }

    const reels = await Video.findAll({
      where: { isUserReel: true, moderationStatus: 'approved', contentType: 'spiritual' },
      include: [{ model: User, as: 'uploader', attributes: ['name'] }]
    });
    res.json(reels.map(mapVideo));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyReels = async (req, res) => {
  try {
    if (isMockMode()) {
      const reels = mockContentStore
        .listVideos()
        .filter((v) => Boolean(v.isUserReel) && toIntId(v.uploadedBy) === toIntId(req.user.id));
      return res.json(reels.map(mapVideo));
    }

    const reels = await Video.findAll({
      where: { isUserReel: true, uploadedBy: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    return res.json(reels.map(mapVideo));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getUserReelModerationQueue = async (req, res) => {
  try {
    const status = String(req.query.status || 'pending');
    const allowed = ['pending', 'approved', 'rejected'];
    const normalizedStatus = allowed.includes(status) ? status : 'pending';
    const contentType = String(req.query.contentType || 'all').toLowerCase();
    const allowedTypes = ['spiritual', 'other'];
    const normalizedContentType = allowedTypes.includes(contentType) ? contentType : 'all';

    if (isMockMode()) {
      let reels = mockContentStore
        .listVideos()
        .filter((v) => Boolean(v.isUserReel) && v.moderationStatus === normalizedStatus);

      if (normalizedContentType !== 'all') {
        reels = reels.filter((v) => String(v.contentType || 'other') === normalizedContentType);
      }

      return res.json(reels.map(mapVideo));
    }

    const where = { isUserReel: true, moderationStatus: normalizedStatus };
    if (normalizedContentType !== 'all') {
      where.contentType = normalizedContentType;
    }

    const reels = await Video.findAll({
      where,
      include: [{ model: User, as: 'uploader', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
    });
    return res.json(reels.map(mapVideo));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.moderateUserReel = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const allowed = ['approved', 'rejected', 'pending'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid moderation status' });
    }

    if (status === 'rejected' && !String(note || '').trim()) {
      return res.status(400).json({ message: 'Rejection note is required' });
    }

    if (isMockMode()) {
      const reels = mockContentStore.listVideos();
      const reel = reels.find((item) => toIntId(item.id) === toIntId(id) && Boolean(item.isUserReel));
      if (!reel) {
        return res.status(404).json({ message: 'User reel not found' });
      }

      reel.moderationStatus = status;
      reel.moderationNote = note || '';
      reel.reviewedBy = req.user.id;
      reel.updatedAt = new Date().toISOString();
      return res.json(mapVideo(reel));
    }

    const reel = await Video.findOne({ where: { id, isUserReel: true } });
    if (!reel) {
      return res.status(404).json({ message: 'User reel not found' });
    }

    reel.moderationStatus = status;
    reel.moderationNote = note || '';
    reel.reviewedBy = req.user.id;
    await reel.save();

    return res.json(mapVideo(reel));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateMyReel = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = isMockMode()
      ? mockContentStore
          .listVideos()
          .find((item) => toIntId(item.id) === toIntId(id) && Boolean(item.isUserReel))
      : await Video.findOne({ where: { id, isUserReel: true } });

    if (!existing) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    const isOwner = toIntId(existing.uploadedBy) === toIntId(req.user.id);
    const isAdmin = req.user?.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not allowed to edit this reel' });
    }

    if (req.body.videoUrl || req.body.youtubeUrl) {
      return res.status(400).json({ message: 'Video link updates are not allowed. Upload a video file instead.' });
    }

    const title = req.body.title ?? existing.title;
    const description = req.body.description ?? existing.description;
    const uploadedFile = req.file;
    const videoUrl = uploadedFile?.filename ? buildUploadedVideoUrl(req, uploadedFile.filename) : existing.videoUrl;
    const tags = normalizeTags(req.body.tags ?? existing.tags);

    if (!title || !videoUrl) {
      return res.status(400).json({ message: 'Title and video URL are required' });
    }

    if (uploadedFile?.path) {
      const duration = await getVideoDurationSeconds(uploadedFile.path);
      if (duration > MAX_REEL_DURATION_SECONDS) {
        fs.unlink(uploadedFile.path, () => {});
        return res.status(400).json({ message: `Reel must be ${MAX_REEL_DURATION_SECONDS} seconds or less` });
      }
    }

    const detectedSpiritual = isSpiritualContent({ title, description, tags });

    if (!detectedSpiritual && !isAdmin) {
      if (uploadedFile?.path) {
        fs.unlink(uploadedFile.path, () => {});
      }
      return res.status(400).json({
        message: 'Only spiritual content reels are allowed for user uploads.',
      });
    }

    const nextModerationStatus = isAdmin ? 'approved' : 'pending';

    existing.title = title;
    existing.description = description;
    existing.videoUrl = videoUrl;
    existing.tags = tags;
    existing.contentType = 'spiritual';
    existing.moderationStatus = nextModerationStatus;
    existing.moderationNote = '';

    if (isMockMode()) {
      existing.updatedAt = new Date().toISOString();
      return res.json({
        ...mapVideo(existing),
        message: nextModerationStatus === 'pending'
          ? 'Reel updated and resubmitted for admin review'
          : 'Reel updated successfully',
      });
    }

    await existing.save();
    return res.json({
      ...mapVideo(existing),
      message: nextModerationStatus === 'pending'
        ? 'Reel updated and resubmitted for admin review'
        : 'Reel updated successfully',
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteMyReel = async (req, res) => {
  try {
    const { id } = req.params;

    if (isMockMode()) {
      const reels = mockContentStore.listVideos();
      const reel = reels.find((item) => toIntId(item.id) === toIntId(id) && Boolean(item.isUserReel));
      if (!reel) {
        return res.status(404).json({ message: 'Reel not found' });
      }

      const isOwner = toIntId(reel.uploadedBy) === toIntId(req.user.id);
      const isAdmin = req.user?.role === 'admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Not allowed to delete this reel' });
      }

      const removed = mockContentStore.deleteVideo(id);
      return res.json({ message: 'Reel deleted successfully', id: removed?.id || Number(id) });
    }

    const reel = await Video.findOne({ where: { id, isUserReel: true } });
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    const isOwner = toIntId(reel.uploadedBy) === toIntId(req.user.id);
    const isAdmin = req.user?.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not allowed to delete this reel' });
    }

    await reel.destroy();
    return res.json({ message: 'Reel deleted successfully', id: Number(id) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.toggleUserReelLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = toIntId(req.user.id);

    if (isMockMode()) {
      const reels = mockContentStore.listVideos();
      const reel = reels.find((item) => toIntId(item.id) === toIntId(id) && Boolean(item.isUserReel));
      if (!reel) {
        return res.status(404).json({ message: 'Reel not found' });
      }

      const likedBy = Array.isArray(reel.likedBy) ? reel.likedBy.map(toIntId) : [];
      const hasLiked = likedBy.includes(userId);

      reel.likedBy = hasLiked ? likedBy.filter((uid) => uid !== userId) : [...likedBy, userId];
      reel.likesCount = reel.likedBy.length;
      reel.updatedAt = new Date().toISOString();

      return res.json({ liked: !hasLiked, reel: mapVideo(reel) });
    }

    const reel = await Video.findOne({ where: { id, isUserReel: true } });
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    const likedBy = Array.isArray(reel.likedBy) ? reel.likedBy.map(toIntId) : [];
    const hasLiked = likedBy.includes(userId);

    reel.likedBy = hasLiked ? likedBy.filter((uid) => uid !== userId) : [...likedBy, userId];
    reel.likesCount = reel.likedBy.length;
    await reel.save();

    return res.json({ liked: !hasLiked, reel: mapVideo(reel) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.shareUserReel = async (req, res) => {
  try {
    const { id } = req.params;

    if (isMockMode()) {
      const reels = mockContentStore.listVideos();
      const reel = reels.find((item) => toIntId(item.id) === toIntId(id) && Boolean(item.isUserReel));
      if (!reel) {
        return res.status(404).json({ message: 'Reel not found' });
      }

      reel.sharesCount = Number(reel.sharesCount || 0) + 1;
      reel.updatedAt = new Date().toISOString();
      return res.json(mapVideo(reel));
    }

    const reel = await Video.findOne({ where: { id, isUserReel: true } });
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    reel.sharesCount = Number(reel.sharesCount || 0) + 1;
    await reel.save();

    return res.json(mapVideo(reel));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.addUserReelComment = async (req, res) => {
  try {
    const { id } = req.params;
    const text = String(req.body.text || '').trim();

    if (!text) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const comment = {
      id: Date.now(),
      userId: req.user.id,
      userName: req.user.name || 'Seeker',
      userEmail: req.user.email || null,
      userProfilePicture: req.user.profilePicture || null,
      userRole: req.user.role || 'user',
      text,
      createdAt: new Date().toISOString(),
    };

    if (isMockMode()) {
      const reels = mockContentStore.listVideos();
      const reel = reels.find((item) => toIntId(item.id) === toIntId(id) && Boolean(item.isUserReel));
      if (!reel) {
        return res.status(404).json({ message: 'Reel not found' });
      }

      const comments = Array.isArray(reel.comments) ? reel.comments : [];
      reel.comments = [comment, ...comments].slice(0, 200);
      reel.commentsCount = reel.comments.length;
      reel.updatedAt = new Date().toISOString();
      return res.status(201).json(mapVideo(reel));
    }

    const reel = await Video.findOne({ where: { id, isUserReel: true } });
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    const comments = Array.isArray(reel.comments) ? reel.comments : [];
    reel.comments = [comment, ...comments].slice(0, 200);
    reel.commentsCount = reel.comments.length;
    await reel.save();

    return res.status(201).json(mapVideo(reel));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;

    if (isMockMode()) {
      const removedVideo = mockContentStore.deleteVideo(id);
      if (!removedVideo) {
        return res.status(404).json({ message: 'Video not found' });
      }
      return res.json({ message: 'Video deleted successfully', id: removedVideo.id });
    }

    const video = await Video.findByPk(id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    await video.destroy();
    return res.json({ message: 'Video deleted successfully', id: Number(id) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
