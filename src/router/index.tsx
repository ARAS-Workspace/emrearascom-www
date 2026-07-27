import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import MainLayout from '@shared/components/layout/MainLayout';
import ErrorPage from '@shared/pages/error/ErrorPage';
import LoadingSpinner from '@shared/components/ui/LoadingSpinner';

// ── Home (CV) ─────────────────────────────────────────────────────
const HomePage = lazy(() => import('@pages/home'));

// ── Blog ──────────────────────────────────────────────────────────
// Two entries, however many posts. `/blog/:slug` is served by one generic
// renderer that resolves the slug against the content registry, so publishing
// a post never touches this file — see shared/components/blog/posts.ts.
const BlogIndexPage = lazy(() => import('@pages/blog/index'));
const BlogPostPage = lazy(() => import('@pages/blog/post'));

// ── AI ────────────────────────────────────────────────────────────
// The chat component, mounted from an MDX body so the llms pipeline picks the
// page up out of `src/pages/ai/` the same way it picks up a post.
const AIPage = lazy(() => import('@pages/ai'));

// ── Router ────────────────────────────────────────────────────────
const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'blog',
        element: <BlogIndexPage />,
      },
      {
        path: 'blog/:slug',
        element: <BlogPostPage />,
      },
      {
        path: 'ai',
        element: <AIPage />,
      },
    ],
  },
]);

const AppRouter: React.FC = () => {
  return (
    <Suspense fallback={<LoadingSpinner fullscreen />}>
      <RouterProvider router={router} />
    </Suspense>
  );
};

export default AppRouter;
