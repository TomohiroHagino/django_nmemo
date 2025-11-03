"""URL configuration for pages app"""

from django.urls import path
from . import views

app_name = 'pages'

urlpatterns = [
    path('', views.index, name='index'),
    path('page/create/', views.page_create, name='page_create'),
    path('page/<int:page_id>/update/', views.page_update, name='page_update'),
    path('page/<int:page_id>/delete/', views.page_delete, name='page_delete'),
    path('page/<int:page_id>/move/', views.page_move, name='page_move'),
    path('page/<int:page_id>/export/html/', views.export_page_html, name='export_page_html'),
    path('page/<int:page_id>/icon/', views.page_update_icon, name='page_update_icon'),
    path('page/<int:page_id>/reorder/', views.page_reorder, name='page_reorder'),
    path('api/page/<int:page_id>/', views.api_page_detail, name='api_page_detail'),
    path('api/upload-image/', views.upload_image, name='upload_image'),
    path('api/upload-video/', views.upload_video, name='upload_video'),
    path('api/upload-excel/', views.upload_excel, name='upload_excel'),
    path('api/upload-zip/', views.upload_zip, name='upload_zip'),
    path('api/upload-sketch/', views.upload_sketch, name='upload_sketch'),
    path('api/upload-ico/', views.upload_ico, name='upload_ico'),
    path('api/cleanup-temp-images/', views.cleanup_temp_images, name='cleanup_temp_images'),
]