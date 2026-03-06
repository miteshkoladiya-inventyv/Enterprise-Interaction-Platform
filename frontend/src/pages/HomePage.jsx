const HomePage = () => {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-xl">EP</span>
        </div>
        <h1 className="text-2xl font-semibold text-white mb-2">
          Enterprise Platform
        </h1>
        <p className="text-sm text-zinc-400">Welcome to the platform</p>
      </div>
    </div>
  );
};

export default HomePage;
