import { useState } from 'react';
import { Phone, ArrowRight } from 'lucide-react';
import fasalSetuLogo from 'figma:asset/f2d8d5eb903b36577f41dfa3a338cd5f372d0106.png';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { supabase } from '../lib/supabase';

interface LoginSignupProps {
  onLoginSuccess: () => void;
}

export default function LoginSignup({ onLoginSuccess }: LoginSignupProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    if (phoneNumber.length !== 10) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const formattedPhone = `+91${phoneNumber}`;
      
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          channel: 'sms',
        }
      });

      if (error) throw error;
      
      setShowOtpInput(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
      console.error('OTP send error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const formattedPhone = `+91${phoneNumber}`;
      
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms'
      });

      if (error) throw error;
      
      if (data.user) {
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
      console.error('OTP verification error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center mb-6">
            <ImageWithFallback src={fasalSetuLogo} alt="FasalSetu Logo" className="w-32 h-32" />
          </div>
          <h1 className="text-green-800">Welcome to FasalSetu</h1>
          <p className="text-gray-600">Your AI-powered farming companion</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-3xl p-8 shadow-lg border border-green-100 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
              {error}
            </div>
          )}
          
          {!showOtpInput ? (
            <>
              <div className="space-y-3">
                <label className="text-gray-700">Mobile Number</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-500">
                    <Phone className="w-5 h-5" />
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 10-digit number"
                    className="w-full pl-24 pr-4 py-4 bg-gray-50 rounded-2xl border-2 border-gray-200 focus:border-green-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                onClick={handleSendOtp}
                disabled={phoneNumber.length !== 10 || isLoading}
                className="w-full bg-green-600 text-white py-4 rounded-2xl hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span>Sending OTP...</span>
                ) : (
                  <>
                    <span>Send OTP</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-gray-700">Enter OTP</label>
                  <button
                    onClick={() => setShowOtpInput(false)}
                    className="text-green-600 text-sm hover:text-green-700"
                  >
                    Change Number
                  </button>
                </div>
                <p className="text-gray-500 text-sm">
                  Code sent to +91 {phoneNumber}
                </p>
                <input
                  type="tel"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit OTP"
                  className="w-full px-4 py-4 bg-gray-50 rounded-2xl border-2 border-gray-200 focus:border-green-500 focus:outline-none transition-colors text-center tracking-widest"
                />
              </div>

              <button
                onClick={handleVerifyOtp}
                disabled={otp.length !== 6 || isLoading}
                className="w-full bg-green-600 text-white py-4 rounded-2xl hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span>Verifying...</span>
                ) : (
                  <>
                    <span>Verify & Continue</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <button
                onClick={handleSendOtp}
                className="w-full text-green-600 py-2 text-sm hover:text-green-700"
              >
                Resend OTP
              </button>
            </>
          )}
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-2">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <span className="text-xl">🌱</span>
            </div>
            <p className="text-xs text-gray-600">AI Crop Advice</p>
          </div>
          <div className="space-y-2">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <span className="text-xl">📱</span>
            </div>
            <p className="text-xs text-gray-600">Voice Support</p>
          </div>
          <div className="space-y-2">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <span className="text-xl">🌾</span>
            </div>
            <p className="text-xs text-gray-600">Track Crops</p>
          </div>
        </div>
      </div>
    </div>
  );
}
