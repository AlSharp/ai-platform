import { LogoIcon } from '@/components/icons';

function Header() {

  return (
    <div className="flex items-center justify-start h-full">
      <div className="flex items-center h-full">
        <LogoIcon className="bg-green-500 w-12 h-12 pt-1 px-2 mx-4 my-3 rounded-md"/>
        <h1 className="text-3xl font-semibold text-gray-700">OKTrade</h1>
      </div>
      
    </div>
  )
}

export default Header;