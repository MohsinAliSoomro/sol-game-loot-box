import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/logo.png'

function Login() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    
    const { signIn } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    
    const from = location.state?.from?.pathname || '/'

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const { data, error: signInError } = await signIn(username, password)
            
            if (signInError) {
                setError(signInError.message)
                return
            }

            if (data?.user) {
                navigate(from, { replace: true })
            }
        } catch (err) {
            setError('An unexpected error occurred. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="h-[100vh] bg-white ">
            <div className="h-full">

                <div className="flex min-h-full flex-col justify-center items-center px-6 lg:px-8">
                    <div className="sm:mx-auto sm:w-full sm:max-w-sm">
                        <img className="mx-auto h-32 w-auto" src={logo} alt="Your Company" />
                        <h2 className="mb-0 text-center text-2xl/9 font-bold tracking-tight text-gray-900">Sign in to your account</h2>
                    </div>

                    <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
                        {error && (
                            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200">
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        )}
                        
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor="username" className="block text-sm/6 font-medium text-gray-900">Username</label>
                                <div className="mt-2">
                                    <input 
                                        type="text" 
                                        name="username" 
                                        id="username" 
                                        autoComplete="username" 
                                        required 
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        disabled={loading}
                                        className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-orange-600 sm:text-sm/6 disabled:opacity-50" 
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between">
                                    <label htmlFor="password" className="block text-sm/6 font-medium text-gray-900">Password</label>
                                    <div className="text-sm">
                                        <a href="#" className="font-semibold text-orange-700 hover:text-orange-500">Forgot password?</a>
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <input 
                                        type="password" 
                                        name="password" 
                                        id="password" 
                                        autoComplete="current-password" 
                                        required 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={loading}
                                        className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-orange-600 sm:text-sm/6 disabled:opacity-50" 
                                    />
                                </div>
                            </div>

                            <div>
                                <button 
                                    type="submit" 
                                    disabled={loading}
                                    className="flex w-full justify-center rounded-md bg-orange-500 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Signing in...
                                        </span>
                                    ) : 'Sign in'}
                                </button>
                            </div>
                        </form>

                        {/* <p className="mt-10 text-center text-sm/6 text-gray-500">
                            Not a member?
                            <a href="#" className="font-semibold text-orange-700 hover:text-orange-500">Start a 14 day free trial</a>
                        </p> */}
                    </div>
                </div>
            </div>
        </main>
    )
}

export default Login