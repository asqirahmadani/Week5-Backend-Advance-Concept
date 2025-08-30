// review.routes.test.ts
import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { Elysia, t } from 'elysia';

// Create a proper mock for ReviewService
const mockReviewService = {
   createReview: mock(() => Promise.resolve({
      id: 'test-review-id',
      orderId: 'test-order-id',
      customerId: 'test-customer-id',
      restaurantId: 'test-restaurant-id',
      restaurantRating: 5,
      foodQuality: 4,
      deliveryTime: 5,
      restaurantComment: 'Great food!',
      createdAt: new Date(),
      updatedAt: new Date()
   })),
   deleteReview: mock(() => Promise.resolve({ success: true })),
   getCustomerReviews: mock(() => Promise.resolve([{
      id: 'test-review-id',
      restaurantRating: 5,
      restaurantComment: 'Great!'
   }])),
   getRestaurantReviews: mock(() => Promise.resolve([{
      id: 'test-review-id',
      restaurantRating: 5,
      helpfulCount: 2,
      responses: []
   }])),
   getRestaurantStats: mock(() => Promise.resolve({
      totalReviews: 10,
      averageRating: 4.5,
      averageFoodQuality: 4.2,
      averageDeliveryTime: 4.8,
      fiveStars: 5,
      fourStars: 3,
      threeStars: 1,
      twoStars: 1,
      oneStar: 0
   })),
   getDriverReviews: mock(() => Promise.resolve([{
      id: 'test-review-id',
      driverRating: 5,
      driverComment: 'Fast delivery!'
   }])),
   getDriverStats: mock(() => Promise.resolve({
      totalReviews: 15,
      averageRating: 4.7,
      averageDeliveryTime: 4.5
   })),
   addReviewResponse: mock(() => Promise.resolve({
      id: 'test-response-id',
      reviewId: 'test-review-id',
      response: 'Thank you for your feedback!'
   })),
   markReviewHelpful: mock(() => Promise.resolve({
      id: 'test-helpful-id',
      reviewId: 'test-review-id',
      isHelpful: true
   })),
   reportReview: mock(() => Promise.resolve({
      id: 'test-report-id',
      reviewId: 'test-review-id',
      reason: 'spam'
   })),
   getReportedReviews: mock(() => Promise.resolve([{
      report: { id: 'test-report-id', reason: 'spam', status: 'pending' },
      review: { id: 'test-review-id', restaurantComment: 'Test comment' }
   }])),
   resolverReviewReport: mock(() => Promise.resolve({
      id: 'test-report-id',
      status: 'resolved',
      reviewedBy: 'admin-id'
   }))
};

// Mock the ReviewService class
const MockReviewServiceClass = mock(() => mockReviewService);

// Create review routes with dependency injection
const createReviewRoutes = (injectedReviewService?: any) => {
   const protectedRoutes = new Elysia()
      .derive(() => ({
         reviewService: injectedReviewService || mockReviewService
      }))
      .derive(({ headers, set }: any) => {
         const userId = headers['x-user-id'];
         const userRole = headers['x-user-role'];
         const userEmail = headers['x-user-email'];

         if (!userId) {
            set.status = 401;
            throw new Error('Missing user authentication from gateway');
         }

         return {
            user: {
               sub: userId,
               role: userRole,
               email: userEmail
            },
            userId,
            userRole,
            userEmail
         };
      })

      // get customer reviews
      .get('/customer/my-reviews', async ({ user, reviewService }) => {
         const reviews = await reviewService.getCustomerReviews(user.sub);
         return {
            success: true,
            data: reviews
         };
      })

      // create review
      .post('/', async ({ body, user, set, reviewService }) => {
         try {
            const review = await reviewService.createReview({
               ...body,
               customerId: user.sub
            });

            return {
               success: true,
               data: review
            }
         } catch (error) {
            set.status = 400;
            return {
               success: false,
               error: error instanceof Error ? error.message : 'Failed to create review'
            };
         }
      }, {
         body: t.Object({
            orderId: t.String(),
            restaurantId: t.String(),
            restaurantRating: t.Integer({ minimum: 1, maximum: 5 }),
            driverRating: t.Optional(t.Integer({ minimum: 1, maximum: 5 })),
            foodQuality: t.Integer({ minimum: 1, maximum: 5 }),
            deliveryTime: t.Integer({ minimum: 1, maximum: 5 }),
            restaurantComment: t.Optional(t.String()),
            driverComment: t.Optional(t.String())
         })
      })

      // add review response (admin or restaurant owner)
      .post('/:reviewId/response', async ({ params, body, user, set, reviewService }) => {
         try {
            const responderType = user.role === 'admin' ? 'admin' : 'restaurant';
            const response = await reviewService.addReviewResponse({
               reviewId: params.reviewId,
               responderId: user.sub,
               responderType,
               response: body.response
            });

            return {
               success: true,
               data: response
            };
         } catch (error) {
            set.status = 400;
            return {
               success: false,
               error: error instanceof Error ? error.message : 'Failed to add response'
            };
         }
      }, {
         body: t.Object({
            response: t.String({ minLength: 1, maxLength: 1000 })
         })
      })

      // mark review as helpful
      .post('/:reviewId/helpful', async ({ params, body, user, set, reviewService }) => {
         try {
            const helpful = await reviewService.markReviewHelpful(
               params.reviewId,
               user.sub,
               body.isHelpful
            );

            return {
               success: true,
               data: helpful
            };
         } catch (error) {
            set.status = 400;
            return {
               success: false,
               error: error instanceof Error ? error.message : 'Failed to mark review'
            };
         }
      }, {
         body: t.Object({
            isHelpful: t.Boolean()
         })
      })

      // report review
      .post('/:reviewId/report', async ({ params, body, user, set, reviewService }) => {
         try {
            const report = await reviewService.reportReview({
               reviewId: params.reviewId,
               reporterId: user.sub,
               reason: body.reason,
               description: body.description
            });

            return {
               success: true,
               data: report
            };
         } catch (error) {
            set.status = 400;
            return {
               success: false,
               error: error instanceof Error ? error.message : 'Failed to report review'
            };
         }
      }, {
         body: t.Object({
            reason: t.Union([
               t.Literal('spam'),
               t.Literal('inappropriate'),
               t.Literal('fake'),
               t.Literal('offensive'),
               t.Literal('other')
            ]),
            description: t.Optional(t.String())
         })
      })

      // Delete review
      .delete('/:reviewId', async ({ params, set, reviewService }) => {
         try {
            const result = await reviewService.deleteReview(params.reviewId);

            return {
               success: true,
               message: 'Review deleted successfully',
               data: result
            };
         } catch (error) {
            set.status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
            return {
               success: false,
               error: error instanceof Error ? error.message : 'Failed to delete review'
            };
         }
      });

   const publicRoutes = new Elysia()
      .derive(() => ({
         reviewService: injectedReviewService || mockReviewService
      }))

      // get restaurant reviews
      .get('/restaurant/:restaurantId', async ({ params, query, reviewService }) => {
         const page = query.page ? parseInt(query.page) : 1;
         const limit = query.limit ? parseInt(query.limit) : 10;

         const reviews = await reviewService.getRestaurantReviews(
            params.restaurantId,
            page,
            limit
         );

         return {
            success: true,
            data: reviews,
            pagination: { page, limit }
         }
      })

      // get restaurant statistics
      .get('/restaurant/:restaurantId/stats', async ({ params, reviewService }) => {
         const stats = await reviewService.getRestaurantStats(params.restaurantId);
         return {
            success: true,
            data: stats
         };
      })

      // get driver reviews
      .get('/driver/:driverId', async ({ params, reviewService }) => {
         const reviews = await reviewService.getDriverReviews(params.driverId);
         return {
            success: true,
            data: reviews
         };
      })

      // get driver statistics
      .get('/driver/:driverId/stats', async ({ params, reviewService }) => {
         const stats = await reviewService.getDriverStats(params.driverId);
         return {
            success: true,
            data: stats
         };
      })

   return new Elysia({ prefix: '/api/reviews' })
      .use(protectedRoutes)
      .use(publicRoutes);
};

const createAdminRoutes = (injectedReviewService?: any) => {
   return new Elysia({ prefix: '/api/admin/reviews' })
      .derive(() => ({
         reviewService: injectedReviewService || mockReviewService
      }))
      .derive(({ headers, set }: any) => {
         const userId = headers['x-user-id'];
         const userRole = headers['x-user-role'];
         const userEmail = headers['x-user-email'];

         if (!userId) {
            set.status = 401;
            throw new Error('Missing user authentication from gateway');
         }

         if (userRole !== 'admin') {
            set.status = 403;
            throw new Error('Access forbidden: Admins only');
         }

         return {
            user: {
               sub: userId,
               role: userRole,
               email: userEmail
            },
            userId,
            userRole,
            userEmail
         };
      })

      // get reported reviews (admin only)
      .get('/reports', async ({ query, reviewService }) => {
         const reports = await reviewService.getReportedReviews(query.status);
         return {
            success: true,
            data: reports
         };
      })

      // resolve review report (admin only)
      .patch('/reports/:reportId', async ({ params, body, user, set, reviewService }) => {
         try {
            const resolved = await reviewService.resolverReviewReport(
               params.reportId,
               user.sub,
               body.action
            );

            return {
               success: true,
               data: resolved
            };
         } catch (error) {
            set.status = 400;
            return {
               success: false,
               error: error instanceof Error ? error.message : 'Failed to resolve report'
            };
         }
      }, {
         body: t.Object({
            action: t.Union([t.Literal('resolve'), t.Literal('reject')])
         })
      });
};

describe('Review Routes', () => {
   let app: any;

   beforeEach(() => {
      // Reset all mocks
      Object.values(mockReviewService).forEach(mockFn => {
         if (typeof mockFn === 'function' && 'mockClear' in mockFn) {
            mockFn.mockClear();
         }
      });

      // Create app with injected mock service
      app = createReviewRoutes(mockReviewService);
   });

   describe('Protected Routes', () => {
      const mockHeaders = {
         'x-user-id': 'test-user-id',
         'x-user-role': 'customer',
         'x-user-email': 'test@example.com'
      };

      describe('GET /api/reviews/customer/my-reviews', () => {
         it('should return customer reviews successfully', async () => {
            const response = await app
               .handle(new Request('http://localhost/api/reviews/customer/my-reviews', {
                  headers: mockHeaders
               }));

            expect(response.status).toBe(200);

            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.data).toEqual([{
               id: 'test-review-id',
               restaurantRating: 5,
               restaurantComment: 'Great!'
            }]);
            expect(mockReviewService.getCustomerReviews).toHaveBeenCalledWith('test-user-id');
         });

         it('should return 401 when user authentication is missing', async () => {
            const response = await app
               .handle(new Request('http://localhost/api/reviews/customer/my-reviews'));

            expect(response.status).toBe(401);
         });
      });

      describe('POST /api/reviews/', () => {
         const validReviewData = {
            orderId: 'test-order-id',
            restaurantId: 'test-restaurant-id',
            restaurantRating: 5,
            foodQuality: 4,
            deliveryTime: 5,
            restaurantComment: 'Great food!'
         };

         it('should create a review successfully', async () => {
            const response = await app
               .handle(new Request('http://localhost/api/reviews/', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     ...mockHeaders
                  },
                  body: JSON.stringify(validReviewData)
               }));

            expect(response.status).toBe(200);

            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.data.id).toBe('test-review-id');
            expect(mockReviewService.createReview).toHaveBeenCalledWith({
               ...validReviewData,
               customerId: 'test-user-id'
            });
         });

         it('should handle service errors', async () => {
            mockReviewService.createReview.mockRejectedValueOnce(
               new Error('Review already exists for this order')
            );

            const response = await app
               .handle(new Request('http://localhost/api/reviews/', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     ...mockHeaders
                  },
                  body: JSON.stringify(validReviewData)
               }));

            expect(response.status).toBe(400);

            const body = await response.json();
            expect(body.success).toBe(false);
            expect(body.error).toBe('Review already exists for this order');
         });
      });

      describe('POST /api/reviews/:reviewId/response', () => {
         it('should add review response successfully', async () => {
            const responseData = { response: 'Thank you for your feedback!' };

            const response = await app
               .handle(new Request('http://localhost/api/reviews/test-review-id/response', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     ...mockHeaders
                  },
                  body: JSON.stringify(responseData)
               }));

            expect(response.status).toBe(200);

            const body = await response.json();
            expect(body.success).toBe(true);
            expect(mockReviewService.addReviewResponse).toHaveBeenCalledWith({
               reviewId: 'test-review-id',
               responderId: 'test-user-id',
               responderType: 'restaurant',
               response: 'Thank you for your feedback!'
            });
         });

         it('should use admin responder type for admin users', async () => {
            const adminHeaders = { ...mockHeaders, 'x-user-role': 'admin' };
            const responseData = { response: 'Admin response' };

            await app
               .handle(new Request('http://localhost/api/reviews/test-review-id/response', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     ...adminHeaders
                  },
                  body: JSON.stringify(responseData)
               }));

            expect(mockReviewService.addReviewResponse).toHaveBeenCalledWith({
               reviewId: 'test-review-id',
               responderId: 'test-user-id',
               responderType: 'admin',
               response: 'Admin response'
            });
         });
      });

      describe('POST /api/reviews/:reviewId/helpful', () => {
         it('should mark review as helpful successfully', async () => {
            const helpfulData = { isHelpful: true };

            const response = await app
               .handle(new Request('http://localhost/api/reviews/test-review-id/helpful', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     ...mockHeaders
                  },
                  body: JSON.stringify(helpfulData)
               }));

            expect(response.status).toBe(200);

            const body = await response.json();
            expect(body.success).toBe(true);
            expect(mockReviewService.markReviewHelpful).toHaveBeenCalledWith(
               'test-review-id',
               'test-user-id',
               true
            );
         });
      });

      describe('POST /api/reviews/:reviewId/report', () => {
         it('should report review successfully', async () => {
            const reportData = {
               reason: 'spam',
               description: 'This looks like spam'
            };

            const response = await app
               .handle(new Request('http://localhost/api/reviews/test-review-id/report', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     ...mockHeaders
                  },
                  body: JSON.stringify(reportData)
               }));

            expect(response.status).toBe(200);

            const body = await response.json();
            expect(body.success).toBe(true);
            expect(mockReviewService.reportReview).toHaveBeenCalledWith({
               reviewId: 'test-review-id',
               reporterId: 'test-user-id',
               reason: 'spam',
               description: 'This looks like spam'
            });
         });
      });

      describe('DELETE /api/reviews/:reviewId', () => {
         it('should delete review successfully', async () => {
            const response = await app
               .handle(new Request('http://localhost/api/reviews/test-review-id', {
                  method: 'DELETE',
                  headers: mockHeaders
               }));

            expect(response.status).toBe(200);

            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.message).toBe('Review deleted successfully');
            expect(mockReviewService.deleteReview).toHaveBeenCalledWith('test-review-id');
         });

         it('should handle review not found error', async () => {
            mockReviewService.deleteReview.mockRejectedValueOnce(
               new Error('Review not found')
            );

            const response = await app
               .handle(new Request('http://localhost/api/reviews/invalid-id', {
                  method: 'DELETE',
                  headers: mockHeaders
               }));

            expect(response.status).toBe(404);

            const body = await response.json();
            expect(body.success).toBe(false);
            expect(body.error).toBe('Review not found');
         });
      });
   });

   describe('Public Routes', () => {
      describe('GET /api/reviews/restaurant/:restaurantId', () => {
         it('should return restaurant reviews successfully', async () => {
            const response = await app
               .handle(new Request('http://localhost/api/reviews/restaurant/test-restaurant-id?page=1&limit=5'));

            expect(response.status).toBe(200);

            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.data).toEqual([{
               id: 'test-review-id',
               restaurantRating: 5,
               helpfulCount: 2,
               responses: []
            }]);
            expect(body.pagination).toEqual({ page: 1, limit: 5 });
            expect(mockReviewService.getRestaurantReviews).toHaveBeenCalledWith(
               'test-restaurant-id',
               1,
               5
            );
         });

         it('should use default pagination values', async () => {
            await app
               .handle(new Request('http://localhost/api/reviews/restaurant/test-restaurant-id'));

            expect(mockReviewService.getRestaurantReviews).toHaveBeenCalledWith(
               'test-restaurant-id',
               1,
               10
            );
         });
      });

      describe('GET /api/reviews/restaurant/:restaurantId/stats', () => {
         it('should return restaurant statistics successfully', async () => {
            const response = await app
               .handle(new Request('http://localhost/api/reviews/restaurant/test-restaurant-id/stats'));

            expect(response.status).toBe(200);

            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.data.totalReviews).toBe(10);
            expect(body.data.averageRating).toBe(4.5);
            expect(mockReviewService.getRestaurantStats).toHaveBeenCalledWith('test-restaurant-id');
         });
      });

      describe('GET /api/reviews/driver/:driverId', () => {
         it('should return driver reviews successfully', async () => {
            const response = await app
               .handle(new Request('http://localhost/api/reviews/driver/test-driver-id'));

            expect(response.status).toBe(200);

            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.data).toEqual([{
               id: 'test-review-id',
               driverRating: 5,
               driverComment: 'Fast delivery!'
            }]);
            expect(mockReviewService.getDriverReviews).toHaveBeenCalledWith('test-driver-id');
         });
      });

      describe('GET /api/reviews/driver/:driverId/stats', () => {
         it('should return driver statistics successfully', async () => {
            const response = await app
               .handle(new Request('http://localhost/api/reviews/driver/test-driver-id/stats'));

            expect(response.status).toBe(200);

            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.data.totalReviews).toBe(15);
            expect(body.data.averageRating).toBe(4.7);
            expect(mockReviewService.getDriverStats).toHaveBeenCalledWith('test-driver-id');
         });
      });
   });
});

describe('Admin Routes', () => {
   let adminApp: any;

   beforeEach(() => {
      // Reset all mocks
      Object.values(mockReviewService).forEach(mockFn => {
         if (typeof mockFn === 'function' && 'mockClear' in mockFn) {
            mockFn.mockClear();
         }
      });

      adminApp = createAdminRoutes(mockReviewService);
   });

   const adminHeaders = {
      'x-user-id': 'admin-user-id',
      'x-user-role': 'admin',
      'x-user-email': 'admin@example.com'
   };

   describe('GET /api/admin/reviews/reports', () => {
      it('should return all reported reviews for admin', async () => {
         const response = await adminApp
            .handle(new Request('http://localhost/api/admin/reviews/reports', {
               headers: adminHeaders
            }));

         expect(response.status).toBe(200);

         const body = await response.json();
         expect(body.success).toBe(true);
         expect(body.data).toEqual([{
            report: { id: 'test-report-id', reason: 'spam', status: 'pending' },
            review: { id: 'test-review-id', restaurantComment: 'Test comment' }
         }]);
         expect(mockReviewService.getReportedReviews).toHaveBeenCalledWith(undefined);
      });

      it('should filter reported reviews by status', async () => {
         const response = await adminApp
            .handle(new Request('http://localhost/api/admin/reviews/reports?status=pending', {
               headers: adminHeaders
            }));

         expect(response.status).toBe(200);
         expect(mockReviewService.getReportedReviews).toHaveBeenCalledWith('pending');
      });

      it('should return 403 for non-admin users', async () => {
         const customerHeaders = {
            'x-user-id': 'customer-id',
            'x-user-role': 'customer',
            'x-user-email': 'customer@example.com'
         };

         const response = await adminApp
            .handle(new Request('http://localhost/api/admin/reviews/reports', {
               headers: customerHeaders
            }));

         expect(response.status).toBe(403);
      });

      it('should return 401 when authentication is missing', async () => {
         const response = await adminApp
            .handle(new Request('http://localhost/api/admin/reviews/reports'));

         expect(response.status).toBe(401);
      });
   });

   describe('PATCH /api/admin/reviews/reports/:reportId', () => {
      it('should resolve report successfully', async () => {
         const actionData = { action: 'resolve' };

         const response = await adminApp
            .handle(new Request('http://localhost/api/admin/reviews/reports/test-report-id', {
               method: 'PATCH',
               headers: {
                  'Content-Type': 'application/json',
                  ...adminHeaders
               },
               body: JSON.stringify(actionData)
            }));

         expect(response.status).toBe(200);

         const body = await response.json();
         expect(body.success).toBe(true);
         expect(body.data.status).toBe('resolved');
         expect(mockReviewService.resolverReviewReport).toHaveBeenCalledWith(
            'test-report-id',
            'admin-user-id',
            'resolve'
         );
      });

      it('should reject report successfully', async () => {
         const actionData = { action: 'reject' };

         const response = await adminApp
            .handle(new Request('http://localhost/api/admin/reviews/reports/test-report-id', {
               method: 'PATCH',
               headers: {
                  'Content-Type': 'application/json',
                  ...adminHeaders
               },
               body: JSON.stringify(actionData)
            }));

         expect(response.status).toBe(200);

         const body = await response.json();
         expect(body.success).toBe(true);
         expect(mockReviewService.resolverReviewReport).toHaveBeenCalledWith(
            'test-report-id',
            'admin-user-id',
            'reject'
         );
      });

      it('should handle service errors', async () => {
         mockReviewService.resolverReviewReport.mockRejectedValueOnce(
            new Error('Report not found')
         );

         const actionData = { action: 'resolve' };

         const response = await adminApp
            .handle(new Request('http://localhost/api/admin/reviews/reports/invalid-id', {
               method: 'PATCH',
               headers: {
                  'Content-Type': 'application/json',
                  ...adminHeaders
               },
               body: JSON.stringify(actionData)
            }));

         expect(response.status).toBe(400);

         const body = await response.json();
         expect(body.success).toBe(false);
         expect(body.error).toBe('Report not found');
      });

      it('should return 403 for non-admin users', async () => {
         const customerHeaders = {
            'x-user-id': 'customer-id',
            'x-user-role': 'customer',
            'x-user-email': 'customer@example.com'
         };

         const actionData = { action: 'resolve' };

         const response = await adminApp
            .handle(new Request('http://localhost/api/admin/reviews/reports/test-report-id', {
               method: 'PATCH',
               headers: {
                  'Content-Type': 'application/json',
                  ...customerHeaders
               },
               body: JSON.stringify(actionData)
            }));

         expect(response.status).toBe(403);
      });
   });
});