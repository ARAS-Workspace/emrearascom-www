import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import BlogLayout from '@shared/components/layout/BlogLayout';
import ErrorPage from '@shared/pages/error/ErrorPage';
import LoadingSpinner from '@shared/components/ui/LoadingSpinner';

// ── Home (CV) ─────────────────────────────────────────────────────
const HomePage = lazy(() => import('@pages/home'));

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
