const toPlain = (record) => (record && typeof record.toJSON === 'function' ? record.toJSON() : record);

const withMongoStyleId = (item) => {
  const plain = toPlain(item);
  if (!plain) return plain;
  return {
    ...plain,
    _id: plain.id,
  };
};

const mapMovie = (movie) => {
  const plain = withMongoStyleId(movie);
  if (!plain) return plain;

  return {
    ...plain,
    videoUrl: plain.videoUrl || plain.youtubeUrl,
    youtubeUrl: plain.youtubeUrl || plain.videoUrl,
    url: plain.videoUrl || plain.youtubeUrl,
  };
};

const mapStory = (story) => {
  const plain = withMongoStyleId(story);
  if (!plain) return plain;

  return {
    ...plain,
    description: plain.description || plain.summary || '',
  };
};

const mapVideo = (video) => {
  const plain = withMongoStyleId(video);
  if (!plain) return plain;

  const likesCount = Number(plain.likesCount || 0);
  const commentsCount = Number(plain.commentsCount || 0);
  const sharesCount = Number(plain.sharesCount || 0);

  return {
    ...plain,
    videoUrl: plain.videoUrl || plain.youtubeUrl || plain.url,
    youtubeUrl: plain.youtubeUrl || plain.videoUrl || plain.url,
    url: plain.videoUrl || plain.youtubeUrl || plain.url,
    likesCount,
    commentsCount,
    sharesCount,
    likes: likesCount,
    commentsTotal: commentsCount,
    shares: sharesCount,
    uploaderName: plain.uploader?.name || plain.uploaderName || null,
  };
};

const mapSloka = (sloka) => withMongoStyleId(sloka);

module.exports = {
  mapMovie,
  mapStory,
  mapVideo,
  mapSloka,
};