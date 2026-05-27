import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.replace(/^\//, '') || '/';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-7xl font-light text-slate-300">404</h1>
          <div className="h-0.5 w-16 bg-slate-200 mx-auto" />
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-medium text-slate-800">Page Not Found</h2>
          <p className="text-slate-600 leading-relaxed">
            The page <span className="font-medium text-slate-700">"{pageName}"</span> does not exist in this app.
          </p>
        </div>
        <div className="pt-2">
          <Button variant="outline" asChild>
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              Go home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}