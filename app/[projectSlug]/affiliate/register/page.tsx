"use client";
import { supabase } from "@/service/supabase";
import { Formik } from "formik";
import { useState } from "react";
import * as yup from "yup";
import slugify from "slugify";
import Loader from "@/app/Components/Loader";

function generateUniqueId() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // Generates a random 6-digit number
}
const schema = yup.object({
    email: yup.string().email("Invalid email format").required("Email is required"),
    firstName: yup.string().required("First Name is required"),
    lastName: yup.string().required("Last Name is required"),
    discord: yup.string().url("Invalid URL format").required("Discord URL is required"),
    phone: yup
        .string()
        .matches(/^(\+\d{1,2}\s?)?1?\-?\.?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/, "Invalid phone number format")
        .required("Phone is required"),
});
export default function Page() {
    const [step, setStep] = useState(1);
    const handleSubmit = async (values: any) => {
        const { email } = values;
        try {
            const response = await supabase.auth.signUp({
                email,
                password: "password123",
            });
            if (response.data.user) {
                setStep(2);
                const id = generateUniqueId();
                const slug = slugify(`${values.firstName} ${id} OGX`, {
                    trim: true,
                    lower: true,
                });
                const newObj = {
                    ...values,
                    isVerified: true,
                    affiliateId: slug,
                };
                await supabase.from("affiliate").insert(newObj);
            }
        } catch (error) {
            alert("Error signing up");
        }
    };

    const initialValues = {
        email: "",
        firstName: "",
        lastName: "",
        discord: "",
        phone: "",
    };
    return (
        <div className="min-h-screen bg-gradient-to-b from-orange-500 to-orange-600 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8">
                <h1 className="text-center text-3xl font-bold mb-8 bg-gradient-to-r from-orange-500 to-orange-700 bg-clip-text text-transparent">
                    Become an Affiliate
                </h1>
                {step === 1 ? (
                    <Formik
                        initialValues={initialValues}
                        onSubmit={handleSubmit}
                        validationSchema={schema}>
                        {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
                            <form
                                onSubmit={handleSubmit}
                                className="space-y-6">
                                {isSubmitting ? (
                                    <Loader />
                                ) : (
                                    <>
                                        <div className="relative z-0 w-full group">
                                            <input
                                                type="email"
                                                name="email"
                                                className="block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 border-orange-300 appearance-none focus:outline-none focus:ring-0 focus:border-orange-500 peer"
                                                placeholder=" "
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                value={values.email}
                                            />
                                            {errors.email && touched.email ? <div className="text-red-500 text-sm mt-1">{errors.email}</div> : null}
                                            <label
                                                htmlFor="email"
                                                className="peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-orange-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
                                                Email address
                                            </label>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div className="relative z-0 w-full group">
                                                <input
                                                    type="text"
                                                    name="firstName"
                                                    className="block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 border-orange-300 appearance-none focus:outline-none focus:ring-0 focus:border-orange-500 peer"
                                                    placeholder=" "
                                                    onChange={handleChange}
                                                    onBlur={handleBlur}
                                                    value={values.firstName}
                                                />
                                                {errors.firstName && touched.firstName ? <div className="text-red-500 text-sm mt-1">{errors.firstName}</div> : null}
                                                <label
                                                    htmlFor="firstName"
                                                    className="peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-orange-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
                                                    First name
                                                </label>
                                            </div>
                                            <div className="relative z-0 w-full group">
                                                <input
                                                    type="text"
                                                    name="lastName"
                                                    className="block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 border-orange-300 appearance-none focus:outline-none focus:ring-0 focus:border-orange-500 peer"
                                                    placeholder=" "
                                                    onChange={handleChange}
                                                    onBlur={handleBlur}
                                                    value={values.lastName}
                                                />
                                                {errors.lastName && touched.lastName ? <div className="text-red-500 text-sm mt-1">{errors.lastName}</div> : null}
                                                <label
                                                    htmlFor="lastName"
                                                    className="peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-orange-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
                                                    Last name
                                                </label>
                                            </div>
                                        </div>
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div className="relative z-0 w-full group">
                                                <input
                                                    type="text"
                                                    name="phone"
                                                    className="block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 border-orange-300 appearance-none focus:outline-none focus:ring-0 focus:border-orange-500 peer"
                                                    placeholder=" "
                                                    onChange={handleChange}
                                                    onBlur={handleBlur}
                                                    value={values.phone}
                                                />
                                                {errors.phone && touched.phone ? <div className="text-red-500 text-sm mt-1">{errors.phone}</div> : null}
                                                <label
                                                    htmlFor="phone"
                                                    className="peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-orange-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
                                                    Phone no (+1234567890)
                                                </label>
                                            </div>
                                            <div className="relative z-0 w-full group">
                                                <input
                                                    type="text"
                                                    name="discord"
                                                    className="block py-2.5 px-0 w-full text-sm text-gray-900 bg-transparent border-0 border-b-2 border-orange-300 appearance-none focus:outline-none focus:ring-0 focus:border-orange-500 peer"
                                                    placeholder=" "
                                                    onChange={handleChange}
                                                    onBlur={handleBlur}
                                                    value={values.discord}
                                                />
                                                {errors.discord && touched.discord ? <div className="text-red-500 text-sm mt-1">{errors.discord}</div> : null}
                                                <label
                                                    htmlFor="discord"
                                                    className="peer-focus:font-medium absolute text-sm text-gray-500 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 rtl:peer-focus:translate-x-1/4 peer-focus:text-orange-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
                                                    Discord URL
                                                </label>
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full text-white bg-gradient-to-r from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 focus:ring-4 focus:ring-orange-300 font-bold rounded-lg text-sm px-8 py-3 text-center transition-all active:scale-95 disabled:opacity-70">
                                            {isSubmitting ? 'Submitting...' : 'Register as Affiliate'}
                                        </button>
                                    </>
                                )}
                            </form>
                        )}
                    </Formik>
                ) : (
                    <div className="text-center p-8 space-y-4">
                        <div className="text-6xl mb-4">📧</div>
                        <h2 className="text-2xl font-bold text-orange-600">Check Your Email</h2>
                        <p className="text-gray-600">Please visit the email verification link sent to your email to complete your registration.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
