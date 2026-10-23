import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { DemoTourGuide } from '../demo/DemoTourGuide';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-x-hidden pb-28">
          {children}
        </main>
      </div>
      <DemoTourGuide />
    </div>
  );
};
