// src/components/ProfilePostsFeed.jsx
import React, { useState } from 'react';
import {
  Heart, MessageCircle, Share2, Send, Clock,
  MapPin, Film, Loader2, Sparkles, MessageSquare
} from 'lucide-react';
import API, { getMediaUrl } from '../api';
import SafeImage from './SafeImage';
import VerifiedBadge, { isAppCreator } from './VerifiedBadge';

// Safe Date & Time Helpers
function formatSafeTime(dateStr) {
  if (!dateStr) return 'Recently';
  try {
    let cleanStr = typeof dateStr === 'string' ? dateStr.trim() : dateStr;
    if (typeof cleanStr === 'string' && !cleanStr.endsWith('Z') && !cleanStr.includes('+') && !cleanStr.includes('-', 10)) {
      cleanStr += 'Z';
    }
    const d = new Date(typeof cleanStr === 'string' && cleanStr.includes(' ') ? cleanStr.replace(' ', 'T') : cleanStr);
    return isNaN(d.getTime()) ? 'Recently' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Recently';
  }
}

function formatSafeDate(dateStr) {
  if (!dateStr) return 'Recent';
  try {
    let cleanStr = typeof dateStr === 'string' ? dateStr.trim() : dateStr;
    if (typeof cleanStr === 'string' && !cleanStr.endsWith('Z') && !cleanStr.includes('+') && !cleanStr.includes('-', 10)) {
      cleanStr += 'Z';
    }
    const d = new Date(typeof cleanStr === 'string' && cleanStr.includes(' ') ? cleanStr.replace(' ', 'T') : cleanStr);
    return isNaN(d.getTime()) ? 'Recent' : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Recent';
  }
}

export default function ProfilePostsFeed({
  posts = [],
  loading = false,
  currentUser = null,
  profileUser = null,
  onPostUpdated = null,
  showToast = null
}) {
  // Local posts state for instant zero-latency optimistic interactions (like & comment)
  const [localPosts, setLocalPosts] = useState(posts);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});

  // Synchronize when parent posts array updates (e.g. after fresh profile fetch)
  React.useEffect(() => {
    setLocalPosts(posts);
  }, [posts]);

  const notify = (text, type = 'info') => {
    if (showToast) {
      showToast(text, type);
    } else {
      console.log(`[Notification ${type}]: ${text}`);
    }
  };

  // Toggle Like on Post (Facebook style instant optimistic update)
  const handleToggleLike = async (postId) => {
    const post = localPosts.find(p => p.id === postId);
    if (!post) return;

    const nextLiked = !post.has_liked;
    const nextCount = nextLiked ? (post.likes_count || 0) + 1 : Math.max(0, (post.likes_count || 1) - 1);

    // 0ms Optimistic UI Update
    setLocalPosts(prev =>
      prev.map(p => (p.id === postId ? { ...p, has_liked: nextLiked, likes_count: nextCount } : p))
    );

    if (navigator.vibrate) {
      try { navigator.vibrate(15); } catch {}
    }

    try {
      const res = await API.post(`/reels/${postId}/like`);
      if (res?.data) {
        setLocalPosts(prev =>
          prev.map(p => (p.id === postId ? { ...p, has_liked: res.data.has_liked, likes_count: res.data.likes_count } : p))
        );
        if (onPostUpdated) {
          onPostUpdated(postId, { has_liked: res.data.has_liked, likes_count: res.data.likes_count });
        }
      }
    } catch (err) {
      console.error('Error toggling like on profile post:', err);
      // Rollback on failure
      setLocalPosts(prev =>
        prev.map(p => (p.id === postId ? { ...p, has_liked: post.has_liked, likes_count: post.likes_count } : p))
      );
      notify('Failed to like post. Please check your internet connection.', 'error');
    }
  };

  // Submit Comment on Post
  const handleCommentSubmit = async (postId, e) => {
    if (e) e.preventDefault();
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;

    const tempCommentId = `temp_c_${Date.now()}`;
    const optimisticComment = {
      id: tempCommentId,
      reel_id: postId,
      content: text,
      author_name: currentUser?.full_name || 'You',
      author_avatar: currentUser?.profile_picture_url || null,
      author_role: currentUser?.role === 'vendor' ? 'Vendor' : 'Student',
      author_is_verified: isAppCreator({ name: currentUser?.full_name, id: currentUser?.user_id }),
      created_at: new Date().toISOString(),
      is_optimistic: true
    };

    // 1. Clear input field immediately
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));

    // 2. Optimistic insert in comments list & bump counter
    setLocalPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          const currentComments = p.comments || [];
          const updated = [...currentComments, optimisticComment];
          return {
            ...p,
            comments: updated,
            comments_count: updated.length
          };
        }
        return p;
      })
    );

    setSubmittingComment(prev => ({ ...prev, [postId]: true }));

    try {
      const res = await API.post(`/reels/${postId}/comments`, { content: text });
      const savedComment = res.data;

      setLocalPosts(prev =>
        prev.map(p => {
          if (p.id === postId) {
            const updated = (p.comments || []).map(c =>
              c.id === tempCommentId ? savedComment : c
            );
            return {
              ...p,
              comments: updated,
              comments_count: updated.length
            };
          }
          return p;
        })
      );

      notify('Comment posted! 💬', 'success');
      if (onPostUpdated) {
        onPostUpdated(postId, { newComment: savedComment });
      }
    } catch (err) {
      console.error('Failed to post comment on profile post:', err);
      // Remove optimistic comment on error
      setLocalPosts(prev =>
        prev.map(p => {
          if (p.id === postId) {
            const updated = (p.comments || []).filter(c => c.id !== tempCommentId);
            return {
              ...p,
              comments: updated,
              comments_count: updated.length
            };
          }
          return p;
        })
      );
      notify(err.response?.data?.detail || 'Failed to post comment.', 'error');
    } finally {
      setSubmittingComment(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Copy Post Link to Clipboard
  const handleCopyLink = (post) => {
    const url = `${window.location.origin}/dashboard?reel=${post.id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => notify('Post link copied to clipboard! 📋', 'success'))
        .catch(() => notify(`Link: ${url}`, 'info'));
    } else {
      notify(`Link: ${url}`, 'info');
    }
  };

  if (loading) {
    return (
      <div className="py-10 text-center space-y-3">
        <Loader2 className="w-7 h-7 text-sky-500 animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-500">Loading timeline posts...</p>
      </div>
    );
  }

  if (!localPosts || localPosts.length === 0) {
    return (
      <div className="py-8 px-4 text-center bg-slate-50/80 rounded-2xl border border-dashed border-slate-200">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
          <Film className="w-6 h-6" />
        </div>
        <h5 className="text-xs font-bold text-slate-700">No Posts Shared Yet</h5>
        <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs mx-auto">
          {profileUser?.full_name || 'This user'} hasn't posted any campus moments, drops, or updates yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {localPosts.map((post) => {
        const textContent = post.description || post.title || '';
        const hasMedia = Boolean(post.media_url);
        const isVideo = post.media_type === 'video';
        const isCommentsOpen = activeCommentsPostId === post.id;
        const currentComments = post.comments || [];
        const isPostingThisComment = submittingComment[post.id];

        // Author details
        const authorName = post.author_name || profileUser?.full_name || 'Campus Student';
        const authorAvatar = post.author_avatar || profileUser?.profile_picture_url || null;
        const authorRole = post.author_role || (profileUser?.is_seller || profileUser?.role === 'vendor' ? 'Vendor' : 'Student');
        const authorId = post.user_id || profileUser?.user_id || profileUser?.id;

        return (
          <article
            key={post.id}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all hover:border-slate-300"
          >
            {/* 1. Facebook-Style Post Header */}
            <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                {/* Author Avatar */}
                <div className="w-10 h-10 rounded-full bg-slate-100 ring-2 ring-slate-100 overflow-hidden shrink-0 flex items-center justify-center font-black text-xs text-slate-600 select-none">
                  {authorAvatar ? (
                    <SafeImage
                      src={authorAvatar}
                      alt={authorName}
                      fallbackType="avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{authorName.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                {/* Author Info & Timestamps */}
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5 flex-wrap">
                    <span className="font-bold text-xs sm:text-[13px] text-slate-900 truncate">
                      {authorName}
                    </span>
                    {isAppCreator({ name: authorName, id: authorId }) && (
                      <VerifiedBadge size="xs" />
                    )}
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                      {authorRole}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{formatSafeDate(post.created_at)}</span>
                      <span>•</span>
                      <span>{formatSafeTime(post.created_at)}</span>
                    </span>
                    {post.location && (
                      <>
                        <span>•</span>
                        <span className="flex items-center space-x-0.5 text-sky-600 font-semibold truncate">
                          <MapPin className="w-2.5 h-2.5 text-sky-500 shrink-0" />
                          <span className="truncate">{post.location}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Post Content (Text and/or Media) */}
            <div className="space-y-2.5">
              {/* Text / Caption */}
              {textContent && (
                <div className="px-3.5 sm:px-4 text-left">
                  <p className={`text-slate-800 leading-relaxed break-words whitespace-pre-wrap ${
                    !hasMedia && textContent.length < 120
                      ? 'text-sm sm:text-base font-semibold py-1'
                      : 'text-xs sm:text-[13px] font-normal'
                  }`}>
                    {textContent}
                  </p>
                </div>
              )}

              {/* Media Container (Photos / Videos) */}
              {hasMedia && (
                <div className="w-full bg-slate-950 overflow-hidden flex items-center justify-center max-h-[70vh] relative">
                  {isVideo ? (
                    <video
                      src={getMediaUrl(post.media_url)}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full max-h-[70vh] object-contain"
                    />
                  ) : (
                    <SafeImage
                      src={getMediaUrl(post.media_url)}
                      alt={post.title || 'Campus post'}
                      fallbackType="post"
                      className="w-full max-h-[70vh] object-contain bg-slate-900"
                    />
                  )}
                </div>
              )}
            </div>

            {/* 3. Engagement Metrics Row */}
            <div className="px-3.5 sm:px-4 py-2 flex items-center justify-between text-[11px] text-slate-500 font-semibold border-b border-slate-100">
              <span className="flex items-center space-x-1">
                <span className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-white text-[9px] shadow-2xs">
                  ❤️
                </span>
                <span>{post.likes_count || 0} {post.likes_count === 1 ? 'like' : 'likes'}</span>
              </span>

              <button
                type="button"
                onClick={() => setActiveCommentsPostId(isCommentsOpen ? null : post.id)}
                className="hover:underline cursor-pointer text-slate-500 hover:text-slate-800"
              >
                {post.comments_count || currentComments.length || 0} {post.comments_count === 1 ? 'comment' : 'comments'}
              </button>
            </div>

            {/* 4. Facebook-Style Interactive Action Bar */}
            <div className="px-2 py-1 flex items-center justify-around text-xs font-bold text-slate-600 bg-white">
              {/* Like Button */}
              <button
                type="button"
                onClick={() => handleToggleLike(post.id)}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer active:scale-95 ${
                  post.has_liked
                    ? 'text-rose-600 bg-rose-50/60 font-black'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-rose-600'
                }`}
              >
                <Heart className={`w-4 h-4 transition-transform ${post.has_liked ? 'fill-rose-500 text-rose-500 scale-110' : 'text-slate-500'}`} />
                <span>Like</span>
              </button>

              {/* Comment Button */}
              <button
                type="button"
                onClick={() => setActiveCommentsPostId(isCommentsOpen ? null : post.id)}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer active:scale-95 ${
                  isCommentsOpen
                    ? 'text-sky-600 bg-sky-50/60 font-black'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-sky-600'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-sky-500" />
                <span>Comment</span>
              </button>

              {/* Share Button */}
              <button
                type="button"
                onClick={() => handleCopyLink(post)}
                className="flex-1 py-2 rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer hover:bg-slate-50 hover:text-slate-900 active:scale-95 text-slate-600"
              >
                <Share2 className="w-4 h-4 text-slate-500" />
                <span>Share</span>
              </button>
            </div>

            {/* 5. Facebook-Style Comments Drawer */}
            {isCommentsOpen && (
              <div className="p-3.5 sm:p-4 bg-slate-50/90 border-t border-slate-100 space-y-3 animate-in fade-in duration-200">
                {/* Comments List */}
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {currentComments.length > 0 ? (
                    currentComments.map((comment, idx) => (
                      <div key={comment.id || idx} className="flex items-start space-x-2.5 text-left">
                        {/* Commenter Avatar */}
                        <div className="w-7 h-7 rounded-full bg-slate-200 ring-1 ring-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-[10px] text-slate-600 select-none">
                          {comment.author_avatar ? (
                            <img
                              src={comment.author_avatar}
                              alt={comment.author_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{comment.author_name?.charAt(0) || 'U'}</span>
                          )}
                        </div>

                        {/* Comment Bubble */}
                        <div className="flex-1 min-w-0">
                          <div className="inline-block max-w-[95%] bg-white rounded-2xl px-3 py-2 border border-slate-200/80 shadow-2xs">
                            <div className="flex items-center space-x-1 flex-wrap">
                              <span className="font-bold text-[11px] text-slate-900 leading-tight">
                                {comment.author_name}
                              </span>
                              {isAppCreator({ name: comment.author_name, id: comment.user_id }) && (
                                <VerifiedBadge size="xs" />
                              )}
                            </div>
                            <p className="text-xs text-slate-800 leading-relaxed mt-0.5 break-words whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>

                          <div className="flex items-center space-x-2 mt-0.5 ml-2 text-[10px] text-slate-400 font-medium">
                            <span>{formatSafeTime(comment.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-3 text-center text-xs text-slate-400 font-medium">
                      No comments yet. Write the first comment below! 👇
                    </div>
                  )}
                </div>

                {/* Comment Input Box */}
                <form
                  onSubmit={(e) => handleCommentSubmit(post.id, e)}
                  className="flex items-center space-x-2 pt-1 border-t border-slate-200/60"
                >
                  <div className="w-7 h-7 rounded-full bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-[10px] text-slate-600 select-none">
                    {currentUser?.profile_picture_url ? (
                      <img
                        src={currentUser.profile_picture_url}
                        alt="You"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{currentUser?.full_name?.charAt(0) || 'U'}</span>
                    )}
                  </div>

                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={commentInputs[post.id] || ''}
                      onChange={(e) =>
                        setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))
                      }
                      placeholder="Write a comment..."
                      className="w-full bg-white border border-slate-300 rounded-full py-1.5 pl-3.5 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                    <button
                      type="submit"
                      disabled={isPostingThisComment || !(commentInputs[post.id] || '').trim()}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-sky-600 hover:text-sky-700 disabled:opacity-40 disabled:hover:text-sky-600 cursor-pointer"
                      title="Post comment"
                      aria-label="Post comment"
                    >
                      {isPostingThisComment ? (
                        <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
