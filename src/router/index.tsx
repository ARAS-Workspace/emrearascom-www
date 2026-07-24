import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import BlogLayout from '@shared/components/layout/BlogLayout';
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

// ── Router ────────────────────────────────────────────────────────
const router = createBrowserRouter([
  {
    path: '/',
    element: <BlogLayout />,
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
